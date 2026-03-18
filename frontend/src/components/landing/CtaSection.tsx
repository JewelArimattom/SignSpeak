"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function CtaSection() {
  return (
    <section className="relative z-10 max-w-5xl mx-auto px-4 pb-20 pt-8">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-12 md:p-20 text-center relative overflow-hidden"
      >
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[200px] rounded-full bg-white opacity-[0.04] blur-[80px]" />
        </div>
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-white opacity-[0.02] blur-[40px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-white opacity-[0.02] blur-[40px] rounded-full pointer-events-none" />

        <div className="relative">
          <span className="text-xs text-zinc-600 uppercase tracking-[0.2em] font-semibold block mb-6">
            Get Started
          </span>
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-5 leading-tight">
            Start communicating<br />
            <span className="shimmer-text">without limits</span>
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto mb-10 text-lg">
            Join thousands of users already using SignSpeak to break communication barriers every day.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="btn-primary btn-glow-pulse w-full sm:w-auto text-base px-8 py-3">
              Create Free Account
            </Link>
            <Link href="/community" className="btn-secondary w-full sm:w-auto text-base px-8 py-3">
              Join Community →
            </Link>
          </div>
          <p className="text-xs text-zinc-700 mt-6">No credit card required · Works in your browser</p>
        </div>
      </motion.div>
    </section>
  );
}
