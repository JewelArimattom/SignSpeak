"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface PredictionResult {
  letter: string | null;
  confidence: number;
  bbox?: number[];
  top3?: { label: string; score: number }[];
}

interface UseHandSignOptions {
  wsUrl?: string;
  /** Minimum confidence threshold (0-1) to accept a prediction */
  confidenceThreshold?: number;
  /** Lower threshold used while the same letter is already being held */
  sustainThreshold?: number;
  /** Minimum top-1 vs top-2 probability gap to accept lower-confidence predictions */
  minTopGap?: number;
  /** How many ms the same letter must be held before it's committed */
  holdDuration?: number;
}

export function useHandSign({
  wsUrl = "ws://localhost:8000/ws",
  confidenceThreshold = 0.65,
  sustainThreshold = 0.53,
  minTopGap = 0.08,
  holdDuration = 800,
}: UseHandSignOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [connected, setConnected] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [text, setText] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [top3, setTop3] = useState<{ label: string; score: number }[]>([]);

  // Track hold duration for stable letter commitment
  const holdRef = useRef<{ letter: string; since: number } | null>(null);
  const committedRef = useRef(false);

  // Response-driven loop: only send next frame AFTER previous result arrives
  const detectingRef = useRef(false);
  const waitingForResponse = useRef(false);

  // Capture a single frame and send it via WebSocket
  const captureAndSend = useCallback(() => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      !detectingRef.current
    )
      return;

    // Skip if still waiting for the previous response
    if (waitingForResponse.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Use JPEG for much faster encoding (~5x vs PNG)
    canvas.toBlob(
      (blob) => {
        if (!blob || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        waitingForResponse.current = true;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          wsRef.current?.send(
            JSON.stringify({ type: "frame", data: base64 })
          );
        };
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.8
    );
  }, []);

  // Schedule the next frame capture using requestAnimationFrame
  const scheduleNextCapture = useCallback(() => {
    if (!detectingRef.current) return;
    // Small delay to avoid hammering the backend, then use rAF for timing
    setTimeout(() => {
      if (detectingRef.current) {
        requestAnimationFrame(() => captureAndSend());
      }
    }, 50);
  }, [captureAndSend]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      // Mark that we've received the response — ready to send next frame
      waitingForResponse.current = false;

      try {
        const result: { type: string } & PredictionResult = JSON.parse(
          event.data
        );
        if (result.type === "result") {
          const letter = result.letter;
          const conf = result.confidence;
          const candidates = result.top3 ?? [];
          const top1Score = candidates[0]?.score ?? conf;
          const top2Score = candidates[1]?.score ?? 0;
          const topGap = top1Score - top2Score;
          const sustain = Math.min(confidenceThreshold, sustainThreshold);
          const isSameAsCurrentHold =
            Boolean(letter) &&
            Boolean(holdRef.current) &&
            holdRef.current?.letter === letter;
          const effectiveThreshold = isSameAsCurrentHold ? sustain : confidenceThreshold;
          const reliable =
            Boolean(letter) &&
            (conf >= effectiveThreshold || (conf >= sustain && topGap >= minTopGap));

          // Update display immediately
          setCurrentLetter(letter);
          setConfidence(conf);
          setTop3(candidates);

          // Handle hold-to-commit logic
          if (letter && reliable) {
            const now = Date.now();
            if (
              holdRef.current &&
              holdRef.current.letter === letter
            ) {
              if (
                !committedRef.current &&
                now - holdRef.current.since >= holdDuration
              ) {
                setText((prev) => prev + letter);
                committedRef.current = true;
              }
            } else {
              holdRef.current = { letter, since: now };
              committedRef.current = false;
            }
          } else {
            // No hand or low confidence — reset immediately
            holdRef.current = null;
            committedRef.current = false;
          }

          // Immediately schedule the next frame capture
          scheduleNextCapture();
        }
      } catch (e) {
        console.error("Failed to parse WS message:", e);
        scheduleNextCapture();
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log("WebSocket disconnected");
    };

    ws.onerror = () => {
      setConnected(false);
    };

    wsRef.current = ws;
  }, [
    wsUrl,
    confidenceThreshold,
    sustainThreshold,
    minTopGap,
    holdDuration,
    scheduleNextCapture,
  ]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream)?.getTracks();
      tracks?.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Start detection — kick off the first frame capture
  const startDetection = useCallback(() => {
    if (detectingRef.current) return;
    detectingRef.current = true;
    waitingForResponse.current = false;
    setIsDetecting(true);
    // Kick off the first capture
    requestAnimationFrame(() => captureAndSend());
  }, [captureAndSend]);

  // Stop detection
  const stopDetection = useCallback(() => {
    detectingRef.current = false;
    waitingForResponse.current = false;
    setIsDetecting(false);
    setCurrentLetter(null);
    setConfidence(0);
    setTop3([]);
    holdRef.current = null;
    committedRef.current = false;
  }, []);

  // Text manipulation
  const addSpace = useCallback(() => setText((p) => p + " "), []);
  const backspace = useCallback(() => setText((p) => p.slice(0, -1)), []);
  const clearText = useCallback(() => setText(""), []);
  const newLine = useCallback(() => setText((p) => p + "\n"), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      detectingRef.current = false;
      stopCamera();
      wsRef.current?.close();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    connected,
    cameraActive,
    currentLetter,
    confidence,
    top3,
    text,
    isDetecting,
    connect,
    startCamera,
    stopCamera,
    startDetection,
    stopDetection,
    setText,
    addSpace,
    backspace,
    clearText,
    newLine,
  };
}
