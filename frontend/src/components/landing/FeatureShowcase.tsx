"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const FEATURES = [
  {
    badge: "Eye Typing",
    title: "Type using only\nyour eyes",
    description:
      "Our AI tracks your gaze with sub-millimeter precision. Look at a key for 0.8 seconds to type — no hands required. Perfect for ALS, paralysis, and hands-free workflows.",
    points: [
      "Gaze-based virtual keyboard",
      "Word prediction & autocomplete",
      "Works in any browser via webcam",
    ],
    href: "/eye-control",
    cta: "Try Eye Typing",
    visual: "keyboard",
    flip: false,
  },
  {
    badge: "Hand Sign AI",
    title: "Real-time ASL\nrecognition",
    description:
      "Our custom MediaPipe model detects 26 ASL letters and common phrases in real time. Sign naturally, see text appear instantly. No gloves, no wearables.",
    points: [
      "26 ASL letters + phrases",
      "97%+ accuracy in good lighting",
      "Sentence builder with history",
    ],
    href: "/hand-sign",
    cta: "Try Hand Sign",
    visual: "camera",
    flip: true,
  },
  {
    badge: "Community",
    title: "Build & share\ntogether",
    description:
      "Contribute gesture models, share accessibility tools, and connect with researchers and developers pushing the boundaries of human-computer interaction.",
    points: [
      "Open gesture model library",
      "Chat & collaborate with builders",
      "Custom sign sets for any language",
    ],
    href: "/community",
    cta: "Join Community",
    visual: "chat",
    flip: false,
  },
];

const KeyboardVisual = () => (
  <div className="rounded-xl border border-white/8 bg-[#0a0a0a] p-5">
    <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-4">Virtual Keyboard</div>
    <div className="space-y-1.5">
      {[
        ["Q","W","E","R","T","Y","U","I","O","P"],
        ["A","S","D","F","G","H","J","K","L"],
        ["Z","X","C","V","B","N","M"],
      ].map((row, ri) => (
        <div key={ri} className="flex gap-1.5 justify-center">
          {row.map((k) => (
            <div
              key={k}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-mono transition-all ${
                k === "E"
                  ? "bg-[#60a5fa] text-white border-[#60a5fa] shadow-[0_0_12px_rgba(96,165,250,0.35)]"
                  : "bg-white/4 border-white/8 text-zinc-500"
              }`}
            >
              {k}
            </div>
          ))}
        </div>
      ))}
    </div>
    <div className="mt-4 flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-[#60a5fa] shadow-[0_0_8px_rgba(96,165,250,0.6)] animate-pulse-slow" />
      <span className="text-[10px] text-zinc-500">Eye cursor — gazing at E</span>
    </div>
  </div>
);

const CameraVisual = () => (
  <div className="rounded-xl border border-white/8 bg-[#0a0a0a] overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-slow" />
      <span className="text-[10px] text-zinc-600 font-mono">Camera Active</span>
    </div>
    <div className="bg-zinc-950 aspect-video flex items-center justify-center relative">
      <span className="text-7xl select-none">✋</span>
      {/* Skeleton dots */}
      {[
        { top: "25%", left: "45%" },
        { top: "20%", left: "52%" },
        { top: "18%", left: "60%" },
        { top: "22%", left: "67%" },
        { top: "30%", left: "72%" },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.5)]"
          style={pos}
        />
      ))}
    </div>
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="border border-white/10 rounded-lg px-3 py-1.5 bg-black/50">
        <span className="text-lg font-bold text-white font-mono">A</span>
        <span className="text-xs text-zinc-500 ml-2">97%</span>
      </div>
      <div className="text-xs text-zinc-600">Palm open · 3 fingers raised</div>
    </div>
  </div>
);

const ChatVisual = () => (
  <div className="rounded-xl border border-white/8 bg-[#0a0a0a] p-4 space-y-3">
    <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Community Chat</div>
    {[
      { user: "A", msg: "Just trained a model for 50 BSL signs!", time: "2m ago" },
      { user: "R", msg: "SignSpeak helped me present at conference!", time: "5m ago" },
      { user: "K", msg: "Working on Mandarin sign dataset 🔥", time: "8m ago" },
    ].map(({ user, msg, time }, i) => (
      <div key={i} className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs font-bold text-white/60 shrink-0">
          {user}
        </div>
        <div>
          <p className="text-sm text-zinc-300">{msg}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">{time}</p>
        </div>
      </div>
    ))}
  </div>
);

const VISUAL_MAP: Record<string, React.ReactNode> = {
  keyboard: <KeyboardVisual />,
  camera: <CameraVisual />,
  chat: <ChatVisual />,
};

const slideIn = (flip: boolean) => ({
  hidden: { opacity: 0, x: flip ? 60 : -60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: "easeOut" as const } },
});

const fadeIn = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: "easeOut" as const, delay: 0.15 } },
};

export default function FeatureShowcase() {
  return (
    <section className="relative z-10 max-w-6xl mx-auto px-4 py-24 space-y-32">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="text-center"
      >
        <span className="text-xs text-zinc-600 uppercase tracking-[0.2em] font-semibold">Features</span>
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mt-3">
          Accessibility reimagined
        </h2>
        <p className="text-zinc-500 mt-4 max-w-xl mx-auto">
          Three powerful tools. One mission: make communication accessible to everyone.
        </p>
      </motion.div>

      {/* Feature rows */}
      {FEATURES.map((feature) => (
        <div
          key={feature.badge}
          className={`grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center ${
            feature.flip ? "md:[&>:first-child]:order-2 md:[&>:last-child]:order-1" : ""
          }`}
        >
          {/* Text */}
          <motion.div
            variants={slideIn(feature.flip)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <span className="inline-block px-3 py-1 rounded-full text-xs border border-white/10 bg-white/4 text-zinc-400 mb-4 uppercase tracking-wider">
              {feature.badge}
            </span>
            <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-5 whitespace-pre-line leading-tight">
              {feature.title}
            </h3>
            <p className="text-zinc-500 leading-relaxed mb-6">{feature.description}</p>
            <ul className="space-y-2.5 mb-8">
              {feature.points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-zinc-400">
                  <span className="text-white/40 mt-0.5">✓</span>
                  {point}
                </li>
              ))}
            </ul>
            <Link href={feature.href} className="btn-secondary inline-flex">
              {feature.cta} →
            </Link>
          </motion.div>

          {/* Visual */}
          <motion.div
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="feature-card rounded-2xl p-1 border border-white/8"
          >
            {VISUAL_MAP[feature.visual]}
          </motion.div>
        </div>
      ))}
    </section>
  );
}
