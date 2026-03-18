"use client";

import React, { RefObject } from "react";

interface CameraFeedProps {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  cameraActive: boolean;
  currentLetter: string | null;
  confidence: number;
}

export default function CameraFeed({
  videoRef,
  canvasRef,
  cameraActive,
  currentLetter,
  confidence,
}: CameraFeedProps) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/8">
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-auto bg-black"
        style={{ maxHeight: "400px", objectFit: "cover" }}
        autoPlay
        muted
        playsInline
      />

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay when camera is off */}
      {!cameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
          <div className="text-6xl mb-4">📷</div>
          <p className="text-zinc-400 text-sm">Camera not active</p>
          <p className="text-zinc-600 text-xs mt-1">
            Click &quot;Start Camera&quot; to begin
          </p>
        </div>
      )}

      {/* Current detection overlay */}
      {cameraActive && currentLetter && (
        <div className="absolute top-4 left-4 rounded-xl border border-white/10 bg-black/60 backdrop-blur-sm px-4 py-2 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-white letter-pop">
              {currentLetter}
            </span>
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500">Confidence</span>
              <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="confidence-bar h-full rounded-full bg-white"
                  style={{ width: `${Math.round(confidence * 100)}%` }}
                />
              </div>
              <span className="text-xs text-zinc-600 mt-0.5">
                {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Hand detection indicator */}
      {cameraActive && !currentLetter && (
        <div className="absolute top-4 left-4 rounded-xl border border-white/8 bg-black/50 backdrop-blur-sm px-4 py-2">
          <span className="text-xs text-zinc-500">✋ Show your hand sign…</span>
        </div>
      )}
    </div>
  );
}
