"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface HeroSectionProps {
  eyeControlEnabled: boolean;
  onToggleEyeControl: (enabled: boolean) => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: "easeOut" as const, delay },
  }),
};

const KEYBOARD_KEYS = ["Q","W","E","R","T","Y","U","I","O","P","A","S","D","F","G","H","J","K","L"];

export default function HeroSection({
  eyeControlEnabled,
  onToggleEyeControl,
}: HeroSectionProps) {
  return (
    <section className="relative z-10 text-center max-w-5xl mx-auto pt-44 pb-20 px-4">
      {/* Status pill */}
      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/4 text-xs text-zinc-400 mb-8"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-slow" />
        AI-powered hand and eye tracking for communication and accessibility
      </motion.div>

      {/* Heading with floating glow behind it */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[200px] rounded-full bg-white opacity-[0.06] blur-[80px]" />
        </div>
        <motion.h1
          custom={0.1}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="relative text-[clamp(3rem,9vw,5.5rem)] font-extrabold tracking-tight leading-[0.95] mb-6"
        >
          <span className="text-white">Communicate</span>
          <br />
          <span className="shimmer-text">Without Limits</span>
        </motion.h1>
      </div>

      {/* Subtext */}
      <motion.p
        custom={0.2}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="text-lg md:text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto mb-10"
      >
        Use your hands and eyes to write text, navigate a virtual keyboard, and communicate
        naturally. SignSpeak brings camera-based accessibility tools to meetings, learning,
        and live demos.
      </motion.p>

      {/* CTA buttons */}
      <motion.div
        custom={0.3}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5"
      >
        <Link href="/eye-control" className="btn-primary btn-glow-pulse w-full sm:w-auto">
          Try Eye Typing
        </Link>
        <Link href="/hand-sign" className="btn-secondary w-full sm:w-auto">
          Hand Sign →
        </Link>
      </motion.div>

      {/* Eye control toggle */}
      <motion.div
        custom={0.35}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="inline-flex items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-2.5 text-sm mb-12"
      >
        <span className="text-zinc-300">Enable Eye Control</span>
        <button
          type="button"
          onClick={() => onToggleEyeControl(!eyeControlEnabled)}
          aria-pressed={eyeControlEnabled}
          className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
            eyeControlEnabled ? "bg-[#60a5fa]" : "bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full transition-transform duration-200 ${
              eyeControlEnabled ? "bg-white translate-x-5" : "bg-white translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-xs text-zinc-500">
          {eyeControlEnabled ? "Enabled" : "Off by default"}
        </span>
      </motion.div>

      {/* Product preview mockup */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.5 }}
        className="w-full max-w-2xl mx-auto text-left"
      >
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden shadow-[0_0_80px_rgba(255,255,255,0.04)]">
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
            <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="ml-2 text-xs text-zinc-600 font-mono">SignSpeak — Live Preview</span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-pulse-slow" />
              <span className="text-[10px] text-zinc-500">Recording</span>
            </div>
          </div>

          {/* Main panels */}
          <div className="grid grid-cols-5 divide-x divide-white/8" style={{ minHeight: 140 }}>
            {/* Camera feed */}
            <div className="col-span-3 p-5 bg-zinc-950 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-700 uppercase tracking-widest">Camera Feed</span>
              <div className="flex items-center justify-center py-3">
                <span className="text-6xl select-none">🤟</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="border border-white/10 rounded-lg px-2.5 py-1 bg-black/50">
                  <span className="text-base text-white font-bold font-mono">H</span>
                  <span className="text-[10px] text-zinc-500 ml-1.5">94%</span>
                </div>
                <div className="border border-white/8 rounded-lg px-2 py-1 bg-black/30">
                  <span className="text-[10px] text-zinc-600">Confident</span>
                </div>
              </div>
            </div>

            {/* Text output */}
            <div className="col-span-2 p-5 flex flex-col">
              <span className="text-[10px] text-zinc-700 uppercase tracking-widest mb-3">Detected Text</span>
              <div className="text-2xl font-mono font-bold text-white tracking-[0.35em]">
                HELLO<span className="animate-pulse text-white/40">|</span>
              </div>
              <div className="mt-auto space-y-1.5">
                <div className="text-[10px] text-zinc-700">5 signs detected</div>
                <div className="text-[10px] text-zinc-700">Hold 0.8s to confirm</div>
              </div>
            </div>
          </div>

          {/* Virtual keyboard row */}
          <div className="px-4 py-3.5 border-t border-white/8">
            <div className="flex gap-1 flex-wrap">
              {KEYBOARD_KEYS.map((k) => (
                <div
                  key={k}
                  className={`w-7 h-7 rounded-md border flex items-center justify-center text-[11px] font-mono transition-colors ${
                    k === "H"
                      ? "bg-[#60a5fa] text-white border-[#60a5fa] shadow-[0_0_12px_rgba(96,165,250,0.4)]"
                      : "bg-white/4 border-white/8 text-zinc-500"
                  }`}
                >
                  {k}
                </div>
              ))}
              <div className="w-9 h-7 rounded-md border border-white/8 bg-white/4 flex items-center justify-center text-[10px] text-zinc-600 px-1">
                ···
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-zinc-700 mt-3">Real-time AI detection · Works in your browser</p>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="mt-16 flex flex-col items-center gap-2"
      >
        <span className="text-xs text-zinc-700 uppercase tracking-widest">Scroll</span>
        <div className="animate-bounce-down text-zinc-600">↓</div>
      </motion.div>
    </section>
  );
}
