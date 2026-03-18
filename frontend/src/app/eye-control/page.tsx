"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const EYE_CONTROL_STORAGE_KEY = "eye-control-enabled";
const CALIBRATION_STORAGE_KEY = "eye-control-calibration";
const CALIBRATION_EVENT = "eye-control-calibration-changed";
const STATUS_EVENT = "eye-control-status";
const CURSOR_EVENT = "eye-control-cursor";
const RAW_EVENT = "eye-control-raw";

const KEY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
  ["SPACE", "BACKSPACE", "ENTER", "CLEAR"],
] as const;

type EyeCursorPoint = {
  x: number;
  y: number;
};

type EyeControlStatus = {
  enabled: boolean;
  cameraReady: boolean;
};

type CalibrationTarget = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

type CalibrationSample = {
  target: CalibrationTarget;
  point: EyeCursorPoint;
};

type CalibrationConfig = {
  gainX: number;
  gainY: number;
  offsetX: number;
  offsetY: number;
};

const CALIBRATION_STEPS: CalibrationTarget[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "center",
];

const TARGET_LABELS: Record<CalibrationTarget, string> = {
  "top-left": "Top Left",
  "top-right": "Top Right",
  "bottom-left": "Bottom Left",
  "bottom-right": "Bottom Right",
  center: "Center",
};

export default function EyeControlPage() {
  const keyboardRef = useRef<HTMLDivElement | null>(null);
  const keyRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const latestRawRef = useRef<EyeCursorPoint | null>(null);

  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [globalCameraReady, setGlobalCameraReady] = useState(false);
  const [text, setText] = useState("");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [eyeCursor, setEyeCursor] = useState<EyeCursorPoint | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState("");
  const [autoSpeakWords, setAutoSpeakWords] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStepIndex, setCalibrationStepIndex] = useState(0);
  const [calibrationSamples, setCalibrationSamples] = useState<CalibrationSample[]>([]);
  const [calibrationStatus, setCalibrationStatus] = useState("Not calibrated yet.");

  const setHovered = useCallback((key: string | null) => {
    setHoveredKey(key);
  }, []);

  const speakText = useCallback(
    (value: string) => {
      const clean = value.trim();
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      const chosenVoice = voices.find((voice) => voice.voiceURI === selectedVoiceUri);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }
      utterance.rate = speechRate;
      utterance.pitch = 1;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [selectedVoiceUri, speechRate, voices]
  );

  const typeKey = useCallback((key: string) => {
    if (key === "SPACE") {
      setText((prev) => {
        if (autoSpeakWords) {
          const word = prev.trim().split(/\s+/).pop();
          if (word) {
            speakText(word);
          }
        }
        return `${prev} `;
      });
      return;
    }
    if (key === "BACKSPACE") {
      setText((prev) => prev.slice(0, -1));
      return;
    }
    if (key === "ENTER") {
      setText((prev) => {
        if (autoSpeakWords) {
          const word = prev.trim().split(/\s+/).pop();
          if (word) {
            speakText(word);
          }
        }
        return `${prev}\n`;
      });
      return;
    }
    if (key === "CLEAR") {
      setText("");
      return;
    }

    setText((prev) => `${prev}${key}`);
  }, [autoSpeakWords, speakText]);

  const updateHoveredKeyFromCursor = useCallback(
    (cursor: EyeCursorPoint) => {
      let activeKey: string | null = null;
      for (const [key, button] of Object.entries(keyRefs.current)) {
        if (!button) continue;
        const rect = button.getBoundingClientRect();
        const insideX = cursor.x >= rect.left && cursor.x <= rect.right;
        const insideY = cursor.y >= rect.top && cursor.y <= rect.bottom;
        if (insideX && insideY) {
          activeKey = key;
          break;
        }
      }
      setHovered(activeKey);
    },
    [setHovered]
  );

  const ensureGlobalEyeControl = useCallback(() => {
    window.localStorage.setItem(EYE_CONTROL_STORAGE_KEY, "true");
    window.dispatchEvent(new Event("eye-control-toggle"));
  }, []);

  const applyCalibration = useCallback((config: CalibrationConfig) => {
    window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event(CALIBRATION_EVENT));
  }, []);

  useEffect(() => {
    const refreshFromStorage = () => {
      setGlobalEnabled(window.localStorage.getItem(EYE_CONTROL_STORAGE_KEY) === "true");
    };

    const onStatus = (event: Event) => {
      const custom = event as CustomEvent<EyeControlStatus>;
      const detail = custom.detail;
      if (!detail) return;
      setGlobalEnabled(detail.enabled);
      setGlobalCameraReady(detail.cameraReady);
    };

    const onCursor = (event: Event) => {
      const custom = event as CustomEvent<EyeCursorPoint>;
      const detail = custom.detail;
      if (!detail) return;
      setEyeCursor(detail);
      updateHoveredKeyFromCursor(detail);
    };

    const onRaw = (event: Event) => {
      const custom = event as CustomEvent<EyeCursorPoint>;
      const detail = custom.detail;
      if (!detail) return;
      latestRawRef.current = detail;
    };

    refreshFromStorage();

    window.addEventListener(STATUS_EVENT, onStatus as EventListener);
    window.addEventListener(CURSOR_EVENT, onCursor as EventListener);
    window.addEventListener(RAW_EVENT, onRaw as EventListener);
    window.addEventListener("eye-control-toggle", refreshFromStorage as EventListener);

    return () => {
      window.removeEventListener(STATUS_EVENT, onStatus as EventListener);
      window.removeEventListener(CURSOR_EVENT, onCursor as EventListener);
      window.removeEventListener(RAW_EVENT, onRaw as EventListener);
      window.removeEventListener("eye-control-toggle", refreshFromStorage as EventListener);
    };
  }, [updateHoveredKeyFromCursor]);

  const startCalibration = useCallback(() => {
    setIsCalibrating(true);
    setCalibrationStepIndex(0);
    setCalibrationSamples([]);
    setCalibrationStatus("Look at the target point and press Capture.");
  }, []);

  const captureCalibrationPoint = useCallback(() => {
    const point = latestRawRef.current;
    if (!point) {
      setCalibrationStatus("No eye tracking data yet. Keep camera active and try again.");
      return;
    }

    const target = CALIBRATION_STEPS[calibrationStepIndex];
    const filtered = calibrationSamples.filter((sample) => sample.target !== target);
    const next = [...filtered, { target, point }];
    setCalibrationSamples(next);

    if (calibrationStepIndex < CALIBRATION_STEPS.length - 1) {
      setCalibrationStepIndex((prev) => prev + 1);
      setCalibrationStatus(`Captured ${TARGET_LABELS[target]}. Move to next target.`);
      return;
    }

    const byTarget = new Map(next.map((sample) => [sample.target, sample.point]));
    const tl = byTarget.get("top-left");
    const tr = byTarget.get("top-right");
    const bl = byTarget.get("bottom-left");
    const br = byTarget.get("bottom-right");

    if (!tl || !tr || !bl || !br) {
      setCalibrationStatus("Calibration incomplete. Please repeat.");
      setIsCalibrating(false);
      return;
    }

    const minX = (tl.x + bl.x) / 2;
    const maxX = (tr.x + br.x) / 2;
    const minY = (tl.y + tr.y) / 2;
    const maxY = (bl.y + br.y) / 2;

    const spanX = Math.max(maxX - minX, 0.08);
    const spanY = Math.max(maxY - minY, 0.08);

    const gainX = 1 / spanX;
    const gainY = 1 / spanY;
    const offsetX = -minX * gainX;
    const offsetY = -minY * gainY;

    applyCalibration({ gainX, gainY, offsetX, offsetY });
    setCalibrationStatus("Calibration saved and applied globally.");
    setIsCalibrating(false);
  }, [applyCalibration, calibrationSamples, calibrationStepIndex]);

  const resetCalibration = useCallback(() => {
    applyCalibration({ gainX: 1, gainY: 1, offsetX: 0, offsetY: 0 });
    setCalibrationStatus("Calibration reset to default.");
    setIsCalibrating(false);
    setCalibrationStepIndex(0);
    setCalibrationSamples([]);
  }, [applyCalibration]);

  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(allVoices);

      if (!selectedVoiceUri && allVoices.length > 0) {
        const preferred =
          allVoices.find((voice) => /en-US|en-GB/i.test(voice.lang)) ?? allVoices[0];
        setSelectedVoiceUri(preferred.voiceURI);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoiceUri]);

  const typedLength = text.length;
  const lastWord = useMemo(() => {
    return text.trim().split(/\s+/).pop() ?? "";
  }, [text]);

  const currentTarget = isCalibrating ? CALIBRATION_STEPS[calibrationStepIndex] : null;

  return (
    <main className="min-h-screen py-6 px-4 md:px-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Eye Control Keyboard
            </h1>
            <p className="text-gray-500 text-sm mt-1">Type text with shared eye control and blink selection</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className={`px-3 py-1.5 rounded-full text-xs ${globalEnabled ? "badge-success" : "badge-default"}`}>
            Eye Control {globalEnabled ? "Enabled" : "Disabled"}
          </span>
          <span className={`px-3 py-1.5 rounded-full text-xs ${globalCameraReady ? "badge-success" : "badge-default"}`}>
            Camera {globalCameraReady ? "● Ready" : "Starting…"}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          {!globalEnabled && (
            <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
              <h2 className="text-sm font-semibold text-zinc-200 mb-2">Enable Eye Control First</h2>
              <p className="text-sm text-zinc-400 mb-3">
                Turn on Eye Control once, then this page uses the same active camera and tracking automatically.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={ensureGlobalEyeControl}
                  className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors"
                >
                  Enable Eye Control Now
                </button>
                <button
                  onClick={() => window.dispatchEvent(new Event('eye-control-start-temporary'))}
                  className="px-4 py-2 rounded-xl bg-white/8 border border-white/10 text-zinc-200 text-sm hover:bg-white/12 transition-colors"
                >
                  Start Eye Control Here (temporary)
                </button>
              </div>
            </div>
          )}

          <div className="relative rounded-2xl border border-white/8 bg-white/3 p-5" ref={keyboardRef}>
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Virtual Keyboard</h2>

            <div className="space-y-3">
              {KEY_ROWS.map((row) => (
                <div key={row.join("-")} className="flex flex-wrap gap-2.5 justify-center">
                  {row.map((key) => {
                    const isHovered = hoveredKey === key;
                    const isWide = key.length > 1;
                    return (
                      <button
                        key={key}
                        ref={(node) => {
                          keyRefs.current[key] = node;
                        }}
                        onClick={() => typeKey(key)}
                        className={`key-base rounded-xl text-sm transition-all ${
                          isWide ? "px-4 py-3 min-w-[110px]" : "w-12 h-12"
                        } ${isHovered ? "key-active" : ""}`}
                      >
                        {key === "BACKSPACE" ? "⌫" : key === "ENTER" ? "⏎" : key}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

          </div>

          <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Typed Text</h2>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              placeholder="Blink while looking at a key to type here..."
              className="w-full rounded-xl bg-black/40 border border-white/8 p-4 text-sm text-zinc-100 focus:outline-none focus:border-white/25 transition-colors"
            />
            <p className="text-xs text-gray-500 mt-2">Characters: {typedLength}</p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-2">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Live Status</h3>
            <p className="text-sm text-zinc-300">Hover key: {hoveredKey ?? "None"}</p>
            <p className="text-sm text-zinc-300">Cursor: {eyeCursor ? `${Math.round(eyeCursor.x)}, ${Math.round(eyeCursor.y)}` : "None"}</p>
            <p className="text-xs text-zinc-600">
              Tip: look near screen edges to scroll. Blink to click and type.
            </p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Voice Output</h3>
            <label className="text-xs text-zinc-500">Voice</label>
            <select
              value={selectedVoiceUri}
              onChange={(event) => setSelectedVoiceUri(event.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/8 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
            >
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>

            <label className="text-xs text-zinc-500">Speech Rate: {speechRate.toFixed(1)}</label>
            <input
              type="range"
              min={0.7}
              max={1.2}
              step={0.1}
              value={speechRate}
              onChange={(event) => setSpeechRate(Number(event.target.value))}
              className="w-full accent-[#60a5fa]"
            />

            <div className="flex gap-2">
              <button
                onClick={() => speakText(lastWord)}
                className="flex-1 py-2 rounded-xl bg-white/6 border border-white/10 text-zinc-200 text-sm hover:bg-white/10 transition-colors"
              >
                Speak Last Word
              </button>
              <button
                onClick={() => speakText(text)}
                className="flex-1 py-2 rounded-xl bg-white/6 border border-white/10 text-zinc-200 text-sm hover:bg-white/10 transition-colors"
              >
                Speak All
              </button>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={autoSpeakWords}
                onChange={(event) => setAutoSpeakWords(event.target.checked)}
                className="accent-[#60a5fa]"
              />
              Auto-speak each word on space/enter
            </label>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">How to Type</h3>
            <ol className="text-sm text-zinc-500 space-y-2 list-decimal list-inside">
              <li>Enable Eye Control from home once.</li>
              <li>Open this page and wait for camera ready.</li>
              <li>Look at a key to position the eye cursor.</li>
              <li>Blink to select the highlighted key.</li>
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}
