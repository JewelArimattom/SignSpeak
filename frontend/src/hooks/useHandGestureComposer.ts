"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseHandGestureComposerOptions = {
  wsUrl?: string;
  confidenceThreshold?: number;
  sustainThreshold?: number;
  minTopGap?: number;
  letterHoldMs?: number;
  sendGestureLetter?: string;
  sendGestureHoldMs?: number;
  spaceGestureLetter?: string;
  deleteGestureLetter?: string;
  actionGestureHoldMs?: number;
};

export function useHandGestureComposer({
  wsUrl = "ws://localhost:8000/ws",
  confidenceThreshold = 0.65,
  sustainThreshold = 0.53,
  minTopGap = 0.08,
  letterHoldMs = 850,
  sendGestureLetter = "Z",
  sendGestureHoldMs = 1200,
  spaceGestureLetter = "Y",
  deleteGestureLetter = "X",
  actionGestureHoldMs = 900,
}: UseHandGestureComposerOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [connected, setConnected] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);

  const trackingRef = useRef(false);
  const waitingRef = useRef(false);
  const holdRef = useRef<{ letter: string; since: number } | null>(null);
  const committedRef = useRef(false);
  const actionLatchRef = useRef<string | null>(null);

  const captureAndSend = useCallback(() => {
    if (!trackingRef.current) return;
    if (!videoRef.current || !canvasRef.current || !wsRef.current) return;
    if (wsRef.current.readyState !== WebSocket.OPEN || waitingRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        waitingRef.current = true;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = String(reader.result).split(",")[1];
          wsRef.current?.send(JSON.stringify({ type: "frame", data: base64 }));
        };
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.8
    );
  }, []);

  const scheduleNext = useCallback(() => {
    if (!trackingRef.current) return;
    setTimeout(() => {
      if (trackingRef.current) {
        requestAnimationFrame(() => captureAndSend());
      }
    }, 55);
  }, [captureAndSend]);

  const connect = useCallback(
    (
      onCommittedLetter: (letter: string) => void,
      onSendGesture: () => void,
      onSpaceGesture?: () => void,
      onDeleteGesture?: () => void
    ) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        waitingRef.current = false;
        if (trackingRef.current) {
          requestAnimationFrame(() => captureAndSend());
        }
      };

      ws.onmessage = (event) => {
        waitingRef.current = false;

        try {
          const data = JSON.parse(event.data);
          if (data.type !== "result") return;

          const letter = data.letter as string | null;
          const conf = Number(data.confidence ?? 0);
          const top3 = Array.isArray(data.top3) ? data.top3 : [];
          const top1Score = Number(top3[0]?.score ?? conf);
          const top2Score = Number(top3[1]?.score ?? 0);
          const topGap = top1Score - top2Score;
          const sustain = Math.min(confidenceThreshold, sustainThreshold);
          const isSameAsCurrentHold =
            Boolean(letter) &&
            Boolean(holdRef.current) &&
            holdRef.current?.letter === String(letter).toUpperCase();
          const effectiveThreshold = isSameAsCurrentHold ? sustain : confidenceThreshold;
          const reliable =
            Boolean(letter) &&
            (conf >= effectiveThreshold || (conf >= sustain && topGap >= minTopGap));

          setCurrentLetter(letter);
          setConfidence(conf);

          if (letter && reliable) {
            const now = Date.now();
            const normalizedLetter = letter.toUpperCase();
            const sendLetter = sendGestureLetter.toUpperCase();
            const spaceLetter = spaceGestureLetter.toUpperCase();
            const deleteLetter = deleteGestureLetter.toUpperCase();
            const isActionGesture =
              normalizedLetter === sendLetter ||
              normalizedLetter === spaceLetter ||
              normalizedLetter === deleteLetter;

            const holdMs = normalizedLetter === sendLetter ? sendGestureHoldMs : isActionGesture ? actionGestureHoldMs : letterHoldMs;

            if (holdRef.current && holdRef.current.letter === normalizedLetter) {
              if (now - holdRef.current.since >= holdMs) {
                if (normalizedLetter === sendLetter) {
                  if (actionLatchRef.current !== sendLetter) {
                    actionLatchRef.current = sendLetter;
                    onSendGesture();
                  }
                } else if (normalizedLetter === spaceLetter) {
                  if (actionLatchRef.current !== spaceLetter) {
                    actionLatchRef.current = spaceLetter;
                    onSpaceGesture?.();
                  }
                } else if (normalizedLetter === deleteLetter) {
                  if (actionLatchRef.current !== deleteLetter) {
                    actionLatchRef.current = deleteLetter;
                    onDeleteGesture?.();
                  }
                } else if (!committedRef.current) {
                  committedRef.current = true;
                  onCommittedLetter(letter);
                }
              }
            } else {
              holdRef.current = { letter: normalizedLetter, since: now };
              committedRef.current = false;
              actionLatchRef.current = null;
            }
          } else {
            holdRef.current = null;
            committedRef.current = false;
            actionLatchRef.current = null;
          }
        } catch {
          // Ignore malformed prediction payloads.
        }

        scheduleNext();
      };

      ws.onclose = () => {
        setConnected(false);
      };

      ws.onerror = () => {
        setConnected(false);
      };
    },
    [
      actionGestureHoldMs,
      captureAndSend,
      confidenceThreshold,
      sustainThreshold,
      minTopGap,
      deleteGestureLetter,
      letterHoldMs,
      scheduleNext,
      sendGestureHoldMs,
      sendGestureLetter,
      spaceGestureLetter,
      wsUrl,
    ]
  );

  const startCamera = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startTracking = useCallback(() => {
    trackingRef.current = true;
    setTracking(true);
    waitingRef.current = false;
    requestAnimationFrame(() => captureAndSend());
  }, [captureAndSend]);

  const stopTracking = useCallback(() => {
    trackingRef.current = false;
    setTracking(false);
    waitingRef.current = false;
    setCurrentLetter(null);
    setConfidence(0);
    holdRef.current = null;
    committedRef.current = false;
    actionLatchRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      trackingRef.current = false;
      stopCamera();
      wsRef.current?.close();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    connected,
    cameraActive,
    tracking,
    currentLetter,
    confidence,
    connect,
    startCamera,
    stopCamera,
    startTracking,
    stopTracking,
  };
}
