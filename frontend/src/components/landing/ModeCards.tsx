"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface ModeCardsProps {
  eyeControlEnabled: boolean;
}

type ModeItem = {
  href: string;
  icon: string;
  title: string;
  body: string;
  points: string[];
  action: string;
  requiresToggle?: boolean;
};

const MODE_ITEMS: ModeItem[] = [
  {
    href: "/hand-sign",
    icon: "🤟",
    title: "Hand Sign Communication",
    body: "Translate ASL hand signs to text in real-time for meetings and presentations.",
    points: [
      "Real-time letter recognition",
      "Confidence-aware input",
      "Presentation mode",
      "Live top-3 predictions",
    ],
    action: "Start Signing",
  },
  {
    href: "/eye-control",
    icon: "👁️",
    title: "Eye Control Typing",
    body: "Control an on-screen cursor with eye movement and type using blink-based key selection.",
    points: [
      "Real-time eye cursor",
      "Blink-to-select typing",
      "Virtual keyboard page",
      "Accessibility-first workflow",
    ],
    action: "Open Eye Control",
    requiresToggle: true,
  },
  {
    href: "/community",
    icon: "💬",
    title: "Community Group Chat",
    body: "Join real-time community rooms with persistent PostgreSQL history, mentions, and online presence.",
    points: [
      "Real-time group messaging",
      "@mentions with member suggestions",
      "Typing and online indicators",
      "Keyboard + hand-gesture compose",
    ],
    action: "Open Chat",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const, delay: i * 0.1 },
  }),
};

export default function ModeCards({ eyeControlEnabled }: ModeCardsProps) {
  return (
    <section className="relative z-10 max-w-5xl mx-auto px-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {MODE_ITEMS.map((item, i) => (
          <motion.div
            key={item.title}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={cardVariants}
            className="group"
          >
            <article
              className={`feature-card h-full rounded-2xl p-7 border border-white/8 hover:border-white/18 transition-all duration-500 relative overflow-hidden ${
                item.requiresToggle && !eyeControlEnabled ? "opacity-60" : ""
              }`}
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl mb-5 group-hover:bg-white/10 transition-colors duration-300">
                {item.icon}
              </div>

              <h2 className="text-xl font-bold text-white mb-2">{item.title}</h2>
              <p className="text-sm text-zinc-500 leading-relaxed mb-5">{item.body}</p>

              <ul className="space-y-1.5 mb-6">
                {item.points.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-xs text-zinc-600">
                    <span className="w-1 h-1 rounded-full bg-zinc-500 flex-shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>

              {item.requiresToggle && !eyeControlEnabled ? (
                <div className="text-xs text-zinc-500 font-medium">Enable Eye Control from Home</div>
              ) : (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white group-hover:gap-3 transition-all duration-200"
                >
                  {item.action}
                  <span>→</span>
                </Link>
              )}
            </article>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
