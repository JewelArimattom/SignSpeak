"use client";

import React from "react";

interface TextDisplayProps {
  text: string;
  currentLetter: string | null;
  confidence: number;
  confidenceThreshold: number;
}

export default function TextDisplay({
  text,
  currentLetter,
  confidence,
  confidenceThreshold,
}: TextDisplayProps) {
  const showPending =
    currentLetter && confidence >= confidenceThreshold;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 min-h-[200px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
          Typed Text
        </h3>
        <span className="text-xs text-zinc-600">
          {text.length} char{text.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex-1 relative">
        {text || showPending ? (
          <p className="text-2xl font-medium leading-relaxed text-white break-words whitespace-pre-wrap">
            {text}
            {showPending && (
              <span className="text-white/40 letter-pop">
                {currentLetter}
              </span>
            )}
            <span className="cursor-blink text-white/60 ml-0.5">|</span>
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <p className="text-zinc-600 text-lg">No text yet</p>
            <p className="text-zinc-700 text-sm mt-1">
              Hold a hand sign steady to type a letter
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
