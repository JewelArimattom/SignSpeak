"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SMALL_MOVE_DEADZONE_PX = 3.5;
const HEAD_SCROLL_DEADZONE = 0.022;
const HEAD_SCROLL_COOLDOWN_MS = 100;
const DWELL_CLICK_MS = 1500;
const DWELL_MOVE_RESET_PX = 14;
const DWELL_CLICK_COOLDOWN_MS = 1800;

const EYE_CONTROL_STORAGE_KEY = "eye-control-enabled";
const CALIBRATION_STORAGE_KEY = "eye-control-calibration";
const SENSITIVITY_STORAGE_KEY = "eye-control-sensitivity";
const CALIBRATION_EVENT = "eye-control-calibration-changed";
const STATUS_EVENT = "eye-control-status";
const CURSOR_EVENT = "eye-control-cursor";
const RAW_EVENT = "eye-control-raw";

type FaceMeshResult = {
  multiFaceLandmarks?: Array<Array<{ x: number; y: number }>>;
};

type FaceMeshApi = {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: FaceMeshResult) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
};

type CursorPoint = { x: number; y: number };

type CalibrationConfig = {
  gainX: number;
  gainY: number;
  offsetX: number;
  offsetY: number;
};

const DEFAULT_CALIBRATION: CalibrationConfig = {
  gainX: 1,
  gainY: 1,
  offsetX: 0,
  offsetY: 0,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default function EyeMouseController() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<FaceMeshApi | null>(null);
  const frameRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const trackingRef = useRef(false);
  const cursorRef = useRef<CursorPoint | null>(null);
  const dwellStartAtRef = useRef<number | null>(null);
  const dwellAnchorRef = useRef<CursorPoint | null>(null);
  const lastDwellClickRef = useRef(0);
  const lastHeadScrollRef = useRef(0);
  const neutralNoseYRef = useRef<number | null>(null);
  const calibrationRef = useRef<CalibrationConfig>(DEFAULT_CALIBRATION);
  const sensitivityRef = useRef(3); // 1 (slow) → 5 (fast), default 3

  const [enabled, setEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cursor, setCursor] = useState<CursorPoint | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0); // 0–1
  const [sensitivity, setSensitivity] = useState(3);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Load calibration ──────────────────────────────────────────────
  const loadCalibration = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (!raw) { calibrationRef.current = DEFAULT_CALIBRATION; return; }
      const parsed = JSON.parse(raw) as Partial<CalibrationConfig>;
      calibrationRef.current = {
        gainX: typeof parsed.gainX === "number" ? parsed.gainX : 1,
        gainY: typeof parsed.gainY === "number" ? parsed.gainY : 1,
        offsetX: typeof parsed.offsetX === "number" ? parsed.offsetX : 0,
        offsetY: typeof parsed.offsetY === "number" ? parsed.offsetY : 0,
      };
    } catch { calibrationRef.current = DEFAULT_CALIBRATION; }
  }, []);

  const loadSensitivity = useCallback(() => {
    const raw = window.localStorage.getItem(SENSITIVITY_STORAGE_KEY);
    const val = raw ? clamp(parseInt(raw, 10), 1, 5) : 3;
    sensitivityRef.current = val;
    setSensitivity(val);
  }, []);

  const saveSensitivity = useCallback((val: number) => {
    const clamped = clamp(val, 1, 5);
    window.localStorage.setItem(SENSITIVITY_STORAGE_KEY, String(clamped));
    sensitivityRef.current = clamped;
    setSensitivity(clamped);
  }, []);

  // ── Stop engine / camera ──────────────────────────────────────────
  const stopEngine = useCallback(() => {
    trackingRef.current = false;
    if (frameRef.current !== null) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
    if (faceMeshRef.current?.close) faceMeshRef.current.close();
    faceMeshRef.current = null;
    processingRef.current = false;
  }, []);

  const stopCamera = useCallback(() => {
    stopEngine();
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setCursor(null);
    cursorRef.current = null;
    dwellStartAtRef.current = null;
    dwellAnchorRef.current = null;
    setDwellProgress(0);
  }, [stopEngine]);

  // ── Click helpers ─────────────────────────────────────────────────
  const clickAtCursor = useCallback((point: CursorPoint) => {
    const rootEl = document.elementFromPoint(point.x, point.y) as HTMLElement | null;
    if (!rootEl || rootEl.dataset.eyeCursor === "true") return;
    const interactive = rootEl.closest(
      "button, a, input, textarea, select, [role='button'], [tabindex]"
    ) as HTMLElement | null;
    const target = interactive ?? rootEl;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) target.focus();
    if (typeof target.click === "function") { target.click(); return; }
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: point.x, clientY: point.y }));
    target.dispatchEvent(new MouseEvent("mousedown",   { bubbles: true, clientX: point.x, clientY: point.y }));
    target.dispatchEvent(new PointerEvent("pointerup",  { bubbles: true, clientX: point.x, clientY: point.y }));
    target.dispatchEvent(new MouseEvent("mouseup",     { bubbles: true, clientX: point.x, clientY: point.y }));
    target.dispatchEvent(new MouseEvent("click",       { bubbles: true, clientX: point.x, clientY: point.y }));
  }, []);

  // ── Dwell click ───────────────────────────────────────────────────
  const maybeDwellClick = useCallback((point: CursorPoint) => {
    const now = Date.now();
    if (now - lastDwellClickRef.current < DWELL_CLICK_COOLDOWN_MS) {
      setDwellProgress(0);
      return;
    }

    const anchor = dwellAnchorRef.current;
    if (!anchor) {
      dwellAnchorRef.current = point;
      dwellStartAtRef.current = now;
      setDwellProgress(0);
      return;
    }

    const dist = Math.hypot(point.x - anchor.x, point.y - anchor.y);
    if (dist > DWELL_MOVE_RESET_PX) {
      dwellAnchorRef.current = point;
      dwellStartAtRef.current = now;
      setDwellProgress(0);
      return;
    }

    const elapsed = now - (dwellStartAtRef.current ?? now);
    const progress = clamp(elapsed / DWELL_CLICK_MS, 0, 1);
    setDwellProgress(progress);

    if (progress >= 1) {
      clickAtCursor(point);
      lastDwellClickRef.current = now;
      dwellStartAtRef.current = null;
      dwellAnchorRef.current = null;
      setDwellProgress(0);
    }
  }, [clickAtCursor]);

  // ── Head scroll ───────────────────────────────────────────────────
  const maybeHeadScroll = useCallback((noseY: number) => {
    if (neutralNoseYRef.current === null) { neutralNoseYRef.current = noseY; return; }
    neutralNoseYRef.current = neutralNoseYRef.current * 0.995 + noseY * 0.005;
    const deltaFromNeutral = noseY - neutralNoseYRef.current;
    const now = Date.now();
    if (now - lastHeadScrollRef.current < HEAD_SCROLL_COOLDOWN_MS) return;
    const magnitude = Math.abs(deltaFromNeutral) - HEAD_SCROLL_DEADZONE;
    if (magnitude <= 0) return;
    const speed = clamp(8 + magnitude * 160, 8, 30);
    const scrollDelta = deltaFromNeutral > 0 ? speed : -speed;

    const findScrollable = (el: Element | null): HTMLElement | null => {
      let node = el as HTMLElement | null;
      while (node && node !== document.body) {
        const s = window.getComputedStyle(node);
        if ((s.overflowY === "auto" || s.overflowY === "scroll") && node.scrollHeight > node.clientHeight + 4) return node;
        node = node.parentElement;
      }
      const doc = document.scrollingElement as HTMLElement | null;
      return doc && doc.scrollHeight > doc.clientHeight + 4 ? doc : null;
    };

    const cursorPt = cursorRef.current;
    if (cursorPt) {
      const el = document.elementFromPoint(cursorPt.x, cursorPt.y);
      const scrollable = findScrollable(el);
      if (scrollable && scrollable !== document.documentElement && scrollable !== document.body)
        scrollable.scrollBy({ top: scrollDelta, behavior: "auto" });
    }
    window.scrollBy({ top: scrollDelta, behavior: "auto" });
    lastHeadScrollRef.current = now;
  }, []);

  // ── Adaptive cursor (sensitivity-scaled) ─────────────────────────
  const getAdaptiveCursor = useCallback((prev: CursorPoint, target: CursorPoint) => {
    const dx = target.x - prev.x;
    const dy = target.y - prev.y;
    const dist = Math.hypot(dx, dy);
    if (dist < SMALL_MOVE_DEADZONE_PX) return prev;

    const s = sensitivityRef.current / 3; // 1=0.33×, 3=1×, 5=1.67×
    let alpha = 0.045 * s;
    let maxStep = 2.5 * s;
    if (dist > 80)  { alpha = 0.08  * s; maxStep = 5  * s; }
    if (dist > 180) { alpha = 0.12  * s; maxStep = 9  * s; }

    const easedX = prev.x + dx * alpha;
    const easedY = prev.y + dy * alpha;
    const stepDx = easedX - prev.x;
    const stepDy = easedY - prev.y;
    const stepDist = Math.hypot(stepDx, stepDy);
    if (stepDist <= maxStep) return { x: easedX, y: easedY };
    const scale = maxStep / stepDist;
    return { x: prev.x + stepDx * scale, y: prev.y + stepDy * scale };
  }, []);

  // ── Camera + face mesh ────────────────────────────────────────────
  const startCameraAndTracking = useCallback(async () => {
    if (trackingRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraReady(true);

      const module = await import("@mediapipe/face_mesh");
      const faceMesh = new module.FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      }) as FaceMeshApi;

      faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

      faceMesh.onResults((results: FaceMeshResult) => {
        const landmarks = results.multiFaceLandmarks?.[0];
        if (!landmarks) return;

        const nose = landmarks[1];
        const iris = landmarks[475] ?? landmarks[473] ?? nose;
        if (!nose || !iris) return;

        const xMix = clamp(iris.x * 0.7 + nose.x * 0.3, 0, 1);
        const yMix = clamp(iris.y * 0.7 + nose.y * 0.3, 0, 1);
        const rawX = 1 - xMix;
        const rawY = yMix;
        window.dispatchEvent(new CustomEvent(RAW_EVENT, { detail: { x: rawX, y: rawY } }));

        const cal = calibrationRef.current;
        const normX = clamp(rawX * cal.gainX + cal.offsetX, 0, 1);
        const normY = clamp(rawY * cal.gainY + cal.offsetY, 0, 1);
        const targetX = normX * window.innerWidth;
        const targetY = normY * window.innerHeight;

        const prev = cursorRef.current ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const smoothed = getAdaptiveCursor(prev, { x: targetX, y: targetY });

        cursorRef.current = smoothed;
        setCursor(smoothed);
        window.dispatchEvent(new CustomEvent(CURSOR_EVENT, { detail: smoothed }));
        maybeDwellClick(smoothed);
        maybeHeadScroll(nose.y);
      });

      faceMeshRef.current = faceMesh;
      trackingRef.current = true;

      const loop = async () => {
        if (!trackingRef.current || !videoRef.current) return;
        if (!processingRef.current && videoRef.current.readyState >= 2) {
          processingRef.current = true;
          try { await faceMesh.send({ image: videoRef.current }); } catch { /* keep loop alive */ }
          finally { processingRef.current = false; }
        }
        frameRef.current = requestAnimationFrame(loop);
      };
      frameRef.current = requestAnimationFrame(loop);
    } catch { stopCamera(); }
  }, [getAdaptiveCursor, maybeDwellClick, maybeHeadScroll, stopCamera]);

  // ── Effects ───────────────────────────────────────────────────────
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: { enabled, cameraReady } }));
  }, [enabled, cameraReady]);

  useEffect(() => {
    const readEnabled = () => setEnabled(window.localStorage.getItem(EYE_CONTROL_STORAGE_KEY) === "true");
    readEnabled();
    loadCalibration();
    loadSensitivity();

    const onStorage = (e: StorageEvent) => { if (e.key === EYE_CONTROL_STORAGE_KEY) readEnabled(); };
    const onToggle = () => readEnabled();
    const onCalibChange = () => loadCalibration();
    const onStartTemp = () => setEnabled(true);
    const onStopTemp = () => setEnabled(false);

    window.addEventListener("storage", onStorage);
    window.addEventListener("eye-control-toggle", onToggle as EventListener);
    window.addEventListener(CALIBRATION_EVENT, onCalibChange as EventListener);
    window.addEventListener("eye-control-start-temporary", onStartTemp as EventListener);
    window.addEventListener("eye-control-stop-temporary", onStopTemp as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("eye-control-toggle", onToggle as EventListener);
      window.removeEventListener(CALIBRATION_EVENT, onCalibChange as EventListener);
      window.removeEventListener("eye-control-start-temporary", onStartTemp as EventListener);
      window.removeEventListener("eye-control-stop-temporary", onStopTemp as EventListener);
    };
  }, [loadCalibration, loadSensitivity]);

  useEffect(() => {
    if (enabled) {
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      cursorRef.current = center;
      setCursor(center);
      window.dispatchEvent(new CustomEvent(CURSOR_EVENT, { detail: center }));
      startCameraAndTracking();
    } else {
      stopCamera();
    }
    return () => { stopCamera(); };
  }, [enabled, startCameraAndTracking, stopCamera]);

  // ── Dwell ring SVG ────────────────────────────────────────────────
  const RING_R = 14;
  const RING_CIRC = 2 * Math.PI * RING_R;

  return (
    <>
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />

      {/* Cursor with dwell ring */}
      {enabled && cursor && (
        <div
          data-eye-cursor="true"
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-1/2"
          style={{ left: cursor.x, top: cursor.y }}
        >
          <svg width={36} height={36} viewBox="0 0 36 36">
            {/* background ring */}
            <circle cx={18} cy={18} r={RING_R} fill="rgba(110,231,183,0.15)" stroke="rgba(110,231,183,0.4)" strokeWidth={2} />
            {/* dwell progress arc */}
            {dwellProgress > 0 && (
              <circle
                cx={18} cy={18} r={RING_R}
                fill="none"
                stroke="#6ee7b7"
                strokeWidth={3}
                strokeDasharray={RING_CIRC}
                strokeDashoffset={RING_CIRC * (1 - dwellProgress)}
                strokeLinecap="round"
                transform="rotate(-90 18 18)"
              />
            )}
            {/* center dot */}
            <circle cx={18} cy={18} r={3} fill="#6ee7b7" />
          </svg>
        </div>
      )}

      {/* Status + sensitivity panel */}
      {enabled && (
        <div className="pointer-events-auto fixed bottom-3 right-3 z-[9998] flex flex-col items-end gap-1">
          <button
            data-eye-cursor="true"
            onClick={() => setSettingsOpen((o) => !o)}
            className="rounded-lg bg-black/70 px-3 py-1 text-xs text-emerald-200 hover:bg-black/90 transition-colors"
          >
            Eye Control {cameraReady ? "Active ⚙" : "Starting..."}
          </button>

          {settingsOpen && (
            <div
              data-eye-cursor="true"
              className="rounded-xl bg-black/80 border border-emerald-400/20 px-4 py-3 flex flex-col gap-2 min-w-[200px]"
            >
              <p className="text-xs text-emerald-300 font-semibold">Cursor Sensitivity</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Slow</span>
                <input
                  type="range" min={1} max={5} step={1} value={sensitivity}
                  onChange={(e) => saveSensitivity(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs text-gray-400">Fast</span>
              </div>
              <p className="text-xs text-gray-500 text-center">Level {sensitivity} / 5</p>
              <p className="text-xs text-gray-500 mt-1">Hold cursor still 1.5s to click</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
