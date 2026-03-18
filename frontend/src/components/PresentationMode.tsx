"use client";

import React, { useEffect, useCallback, useRef } from "react";

interface PresentationModeProps {
  text: string;
  isActive: boolean;
  currentLetter: string | null;
  cameraActive: boolean;
  sourceVideoRef: React.RefObject<HTMLVideoElement>;
  onAddSpace: () => void;
  onBackspace: () => void;
  onNewLine: () => void;
  onClear: () => void;
  onClose: () => void;
}

export default function PresentationMode({
  text,
  isActive,
  currentLetter,
  cameraActive,
  sourceVideoRef,
  onAddSpace,
  onBackspace,
  onNewLine,
  onClear,
  onClose,
}: PresentationModeProps) {
  const presenterVideoRef = useRef<HTMLVideoElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isActive) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isActive, handleKeyDown]);

  useEffect(() => {
    if (!isActive) return;

    const syncVideoStream = () => {
      const source = sourceVideoRef.current;
      const target = presenterVideoRef.current;
      if (!source || !target) return;
      const stream = source.srcObject;
      if (stream && target.srcObject !== stream) {
        target.srcObject = stream;
      }
    };

    syncVideoStream();
    const interval = window.setInterval(syncVideoStream, 300);
    return () => window.clearInterval(interval);
  }, [isActive, sourceVideoRef]);

  if (!isActive) return null;

  // Calculate font size based on text length
  const getFontSize = () => {
    const len = text.length;
    if (len < 20) return "text-7xl";
    if (len < 50) return "text-5xl";
    if (len < 100) return "text-4xl";
    if (len < 200) return "text-3xl";
    return "text-2xl";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse-slow" />
          <span className="text-sm text-zinc-400 font-medium">
            SignSpeak — Live
          </span>
        </div>
        <div className="flex items-center gap-4">
          {currentLetter && (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-400">Detecting:</span>
              <span className="text-lg font-bold text-white letter-pop">
                {currentLetter}
              </span>
            </div>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/4 px-4 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            ESC to exit
          </button>
        </div>
      </div>

      {/* Main text display */}
      <div className="flex-1 flex items-center justify-center px-16">
        <p
          className={`${getFontSize()} font-bold text-center leading-relaxed text-white break-words whitespace-pre-wrap max-w-[90vw]`}
        >
          {text}
          <span className="cursor-blink text-white/50">|</span>
        </p>
      </div>

      {/* Presenter tools (camera + text controls) */}
      <aside className="absolute right-6 top-20 w-[300px] rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl p-4">
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Presenter Tools
        </h4>

        <div className="rounded-xl overflow-hidden border border-white/8 mb-3 bg-black">
          <video
            ref={presenterVideoRef}
            className="w-full h-auto camera-mirror"
            autoPlay
            muted
            playsInline
          />
          {!cameraActive && (
            <div className="px-3 py-2 text-xs text-zinc-600 border-t border-white/5">
              Camera not active
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onAddSpace}
            className="py-2 rounded-xl text-sm font-medium bg-white/6 text-zinc-300 border border-white/8 hover:bg-white/10 transition-all"
          >
            ␣ Space
          </button>
          <button
            onClick={onBackspace}
            disabled={!text}
            className="py-2 rounded-xl text-sm font-medium bg-white/6 text-zinc-300 border border-white/8 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Delete
          </button>
          <button
            onClick={onNewLine}
            className="py-2 rounded-xl text-sm font-medium bg-white/6 text-zinc-300 border border-white/8 hover:bg-white/10 transition-all"
          >
            ↵ New Line
          </button>
          <button
            onClick={onClear}
            disabled={!text}
            className="py-2 rounded-xl text-sm font-medium bg-white/6 text-zinc-300 border border-white/8 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ✕ Clear
          </button>
        </div>
      </aside>

      {/* Bottom hint */}
      <div className="text-center pb-6 border-t border-white/5 pt-4">
        <p className="text-xs text-zinc-700">
          Press ESC or click the button above to exit presentation mode
        </p>
      </div>
    </div>
  );
}
