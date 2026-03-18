"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function LiveDemoSection() {
  return (
    <section className="relative z-10 max-w-5xl mx-auto px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-10 md:p-16 relative overflow-hidden"
      >
        {/* Corner glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-white opacity-[0.03] blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-[0.02] blur-[60px] rounded-full pointer-events-none" />

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Left: Text */}
          <div>
            <span className="text-xs text-zinc-600 uppercase tracking-[0.2em] font-semibold block mb-4">
              Live Demo
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-5 leading-tight">
              Try it right now,<br />in your browser
            </h2>
            <p className="text-zinc-500 leading-relaxed mb-8">
              No downloads. No sign-up required. Just open your webcam and start typing with 
              your hands or eyes — powered by real-time AI running entirely in the browser.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/eye-control" className="btn-primary btn-glow-pulse">
                👁 Start Eye Typing
              </Link>
              <Link href="/hand-sign" className="btn-secondary">
                ✋ Hand Sign Mode
              </Link>
            </div>
          </div>

          {/* Right: Mock demo preview */}
          <div className="rounded-2xl border border-white/8 bg-zinc-950 p-5 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <span className="text-[10px] text-zinc-600 ml-2 font-mono">eye-control.local</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {["Q","W","E","R","T","Y","A","S","D","F","G","H","Z","X","C","V","B","N"].map((k, i) => (
                <div
                  key={k + i}
                  className={`h-8 rounded-lg border flex items-center justify-center text-xs font-mono transition-all ${
                    k === "H"
                      ? "bg-white text-black border-white"
                      : "bg-white/4 border-white/8 text-zinc-600"
                  }`}
                >
                  {k}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-white/8 bg-black/40 px-3 py-2">
              <span className="text-sm font-mono text-white">HELLO WORLD</span>
              <span className="animate-pulse text-white/40">|</span>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
