"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useHandSign } from "@/hooks/useHandSign";
import CameraFeed from "@/components/CameraFeed";
import TextDisplay from "@/components/TextDisplay";
import ControlPanel from "@/components/ControlPanel";
import PresentationMode from "@/components/PresentationMode";
import StatusBadge from "@/components/StatusBadge";
import SignGuide from "@/components/SignGuide";

const CONFIDENCE_THRESHOLD = 0.58;
const HOLD_DURATION_MS = 700;

export default function HandSignPage() {
  const {
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
  } = useHandSign({
    wsUrl: "ws://localhost:8000/ws",
    confidenceThreshold: CONFIDENCE_THRESHOLD,
    holdDuration: HOLD_DURATION_MS,
  });

  const [presentationActive, setPresentationActive] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (presentationActive) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          addSpace();
          break;
        case "Backspace":
          e.preventDefault();
          backspace();
          break;
        case "Enter":
          if (e.shiftKey) {
            e.preventDefault();
            newLine();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [addSpace, backspace, newLine, presentationActive]);

  return (
    <main className="min-h-screen py-6 px-4 md:px-8 max-w-7xl mx-auto">
      {/* Header */}
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
              SignSpeak
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Hand sign recognition for meetings &amp; presentations
            </p>
          </div>
        </div>
        <StatusBadge
          connected={connected}
          cameraActive={cameraActive}
          isDetecting={isDetecting}
        />
      </header>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Camera + Text */}
        <div className="lg:col-span-2 space-y-6">
          {/* Camera */}
          <CameraFeed
            videoRef={videoRef as React.RefObject<HTMLVideoElement>}
            canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
            cameraActive={cameraActive}
            currentLetter={currentLetter}
            confidence={confidence}
          />

          {/* Text display */}
          <TextDisplay
            text={text}
            currentLetter={currentLetter}
            confidence={confidence}
            confidenceThreshold={CONFIDENCE_THRESHOLD}
          />

          {/* Debug: top-3 live predictions */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">
              Live Top-3 Predictions
            </label>
            {top3 && top3.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {top3.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl bg-white/4 border border-white/8 p-2 text-center"
                  >
                    <div className="text-lg font-bold text-white">{item.label}</div>
                    <div className="text-xs text-zinc-500">
                      {Math.round(item.score * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-600">No prediction yet</p>
            )}
          </div>

          {/* Editable text area */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">
              Edit Text Manually
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="You can also type or edit text here..."
              className="w-full bg-black/40 rounded-xl p-3 text-white text-sm border border-white/8 focus:border-white/25 focus:outline-none resize-none transition-colors"
              rows={3}
            />
          </div>
        </div>

        {/* Right column — Controls */}
        <div className="space-y-6">
          <ControlPanel
            connected={connected}
            cameraActive={cameraActive}
            isDetecting={isDetecting}
            text={text}
            onConnect={connect}
            onStartCamera={startCamera}
            onStopCamera={stopCamera}
            onStartDetection={startDetection}
            onStopDetection={stopDetection}
            onAddSpace={addSpace}
            onBackspace={backspace}
            onClear={clearText}
            onNewLine={newLine}
            onPresentation={() => setPresentationActive(true)}
          />

          {/* Sign guide */}
          <SignGuide isOpen={guideOpen} onToggle={() => setGuideOpen(!guideOpen)} />

          {/* Instructions card */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              How to Use
            </h4>
            <ol className="text-sm text-zinc-500 space-y-2 list-decimal list-inside">
              <li>Start the Python backend server first</li>
              <li>Click <strong className="text-zinc-300">Connect to Server</strong></li>
              <li>Click <strong className="text-zinc-300">Start Camera</strong> and allow access</li>
              <li>Click <strong className="text-zinc-300">Start Detection</strong></li>
              <li>Hold a hand sign for about 0.7 seconds to type a letter</li>
              <li>Use <strong className="text-zinc-300">Presentation Mode</strong> to show text full-screen</li>
            </ol>
            <div className="mt-3 pt-3 border-t border-white/8">
              <p className="text-xs text-zinc-600">
                <strong>Shortcuts:</strong> Space = add space, Backspace = delete, Shift+Enter = new line
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-white/20">
        <p>SignSpeak — ASL Hand Sign Detection · Built with Next.js + TensorFlow</p>
      </footer>

      {/* Presentation overlay */}
      <PresentationMode
        text={text}
        isActive={presentationActive}
        currentLetter={currentLetter}
        cameraActive={cameraActive}
        sourceVideoRef={videoRef as React.RefObject<HTMLVideoElement>}
        onAddSpace={addSpace}
        onBackspace={backspace}
        onNewLine={newLine}
        onClear={clearText}
        onClose={() => setPresentationActive(false)}
      />
    </main>
  );
}
