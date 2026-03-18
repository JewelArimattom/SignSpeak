"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    num: "01",
    icon: "📷",
    title: "Camera Detection",
    description: "MediaPipe analyses each video frame at 30fps, detecting hand landmarks and eye gaze points in real time.",
  },
  {
    num: "02",
    icon: "🧠",
    title: "AI Processing",
    description: "A trained neural network classifies gesture patterns against a 26-sign ASL model with 97%+ accuracy.",
  },
  {
    num: "03",
    icon: "✍️",
    title: "Text Generation",
    description: "Detected signs are assembled into words and sentences with context-aware autocomplete and prediction.",
  },
  {
    num: "04",
    icon: "🔊",
    title: "Speech Output",
    description: "The generated text is converted to natural-sounding speech using the Web Speech API — no server needed.",
  },
];

export default function HowItWorks() {
  return (
    <section className="relative z-10 max-w-6xl mx-auto px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="text-center mb-14"
      >
        <span className="text-xs text-zinc-600 uppercase tracking-[0.2em] font-semibold">AI Pipeline</span>
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mt-3">
          How SignSpeak works
        </h2>
        <p className="text-zinc-500 mt-4 max-w-xl mx-auto">
          From camera frame to spoken word — four steps, all in real time.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
            className="feature-card rounded-2xl p-7 border border-white/8 hover:border-white/16 relative group"
          >
            {/* Step number (large, faded) */}
            <div className="text-7xl font-black text-white/4 leading-none mb-4 select-none group-hover:text-white/8 transition-colors">
              {step.num}
            </div>
            <div className="text-2xl mb-3">{step.icon}</div>
            <h4 className="text-base font-bold text-white mb-2">{step.title}</h4>
            <p className="text-sm text-zinc-500 leading-relaxed">{step.description}</p>
            {/* Connector arrow (except last) */}
            {i < STEPS.length - 1 && (
              <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 text-white/10 text-xl z-10">
                →
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
