"use client";

import React from "react";

interface ControlPanelProps {
  connected: boolean;
  cameraActive: boolean;
  isDetecting: boolean;
  text: string;
  onConnect: () => void;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onStartDetection: () => void;
  onStopDetection: () => void;
  onAddSpace: () => void;
  onBackspace: () => void;
  onClear: () => void;
  onNewLine: () => void;
  onPresentation: () => void;
}

export default function ControlPanel({
  connected,
  cameraActive,
  isDetecting,
  text,
  onConnect,
  onStartCamera,
  onStopCamera,
  onStartDetection,
  onStopDetection,
  onAddSpace,
  onBackspace,
  onClear,
  onNewLine,
  onPresentation,
}: ControlPanelProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
      {/* Connection */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Connection
        </h4>
        <button
          onClick={onConnect}
          disabled={connected}
          className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
            connected
              ? "bg-white/8 text-zinc-300 border border-white/10 cursor-default"
              : "bg-white text-black hover:bg-zinc-200"
          }`}
        >
          {connected ? "✓ Connected" : "Connect to Server"}
        </button>
      </div>

      {/* Camera controls */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Camera
        </h4>
        <div className="flex gap-2">
          <button
            onClick={cameraActive ? onStopCamera : onStartCamera}
            disabled={!connected}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              !connected
                ? "bg-white/4 text-zinc-600 cursor-not-allowed"
                : cameraActive
                ? "bg-white/8 text-zinc-200 border border-white/15 hover:bg-white/12"
                : "bg-white/8 text-zinc-200 border border-white/10 hover:bg-white/12"
            }`}
          >
            {cameraActive ? "⏹ Stop" : "📷 Start"}
          </button>
        </div>
      </div>

      {/* Detection */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Detection
        </h4>
        <button
          onClick={isDetecting ? onStopDetection : onStartDetection}
          disabled={!connected || !cameraActive}
          className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
            !connected || !cameraActive
              ? "bg-white/4 text-zinc-600 cursor-not-allowed"
              : isDetecting
              ? "bg-white/10 text-zinc-200 border border-white/20 hover:bg-white/15"
              : "bg-white text-black hover:bg-zinc-200"
          }`}
        >
          {isDetecting ? "⏸ Pause Detection" : "▶ Start Detection"}
        </button>
      </div>

      {/* Text controls */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Text Controls
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onAddSpace}
            className="py-2 rounded-xl text-sm font-medium bg-white/5 text-zinc-300 border border-white/8 hover:bg-white/10 transition-all"
          >
            ␣ Space
          </button>
          <button
            onClick={onBackspace}
            disabled={!text}
            className="py-2 rounded-xl text-sm font-medium bg-white/5 text-zinc-300 border border-white/8 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Delete
          </button>
          <button
            onClick={onNewLine}
            className="py-2 rounded-xl text-sm font-medium bg-white/5 text-zinc-300 border border-white/8 hover:bg-white/10 transition-all"
          >
            ↵ New Line
          </button>
          <button
            onClick={onClear}
            disabled={!text}
            className="py-2 rounded-xl text-sm font-medium bg-white/5 text-zinc-300 border border-white/8 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ✕ Clear All
          </button>
        </div>
      </div>

      {/* Presentation mode */}
      <div>
        <button
          onClick={onPresentation}
          disabled={!text}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-white text-black hover:bg-zinc-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          🖥 Presentation Mode
        </button>
      </div>
    </div>
  );
}
