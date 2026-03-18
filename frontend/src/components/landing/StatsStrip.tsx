"use client";

import { motion } from "framer-motion";

const STATS = [
  { label: "Experience Modes", value: "3" },
  { label: "Supported Signs", value: "24" },
  { label: "Realtime Pipeline", value: "WebSocket" },
  { label: "Chat Storage", value: "PostgreSQL" },
];

export default function StatsStrip() {
  return (
    <section className="relative z-10 max-w-5xl mx-auto px-4 py-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATS.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.08 }}
            className="rounded-2xl px-4 py-5 text-center border border-white/8 bg-white/3 hover:border-white/14 transition-colors"
          >
            <p className="text-2xl font-bold text-white tracking-tight">{item.value}</p>
            <p className="text-xs text-zinc-500 mt-1">{item.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
