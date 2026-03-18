"use client";

import { motion } from "framer-motion";

const STATS = [
  { value: "430M+", label: "People worldwide with hearing loss", source: "WHO 2023" },
  { value: "70M+",  label: "Deaf people who use sign language",  source: "WFD" },
  { value: "1B+",   label: "People living with some disability", source: "WHO" },
  { value: "2.5B",  label: "Will need assistive tech by 2050",  source: "WHO Forecast" },
];

export default function AccessibilityImpact() {
  return (
    <section className="relative z-10 py-28 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <span className="text-xs text-zinc-600 uppercase tracking-[0.2em] font-semibold">Why It Matters</span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mt-3">
            The world needs<br />
            <span className="shimmer-text">better tools</span>
          </h2>
          <p className="text-zinc-500 mt-4 max-w-xl mx-auto">
            Communication is a human right. SignSpeak removes the barriers.
          </p>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/8 rounded-2xl overflow-hidden">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
              className="bg-[#0a0a0a] p-8 flex flex-col justify-between group hover:bg-[#111] transition-colors"
            >
              <div className="text-4xl md:text-5xl font-black text-white tracking-tight mb-3 group-hover:scale-105 transition-transform origin-left">
                {stat.value}
              </div>
              <div>
                <p className="text-sm text-zinc-400 leading-snug">{stat.label}</p>
                <p className="text-[10px] text-zinc-700 mt-2 uppercase tracking-wider">{stat.source}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quote */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center text-zinc-600 text-sm mt-10 italic"
        >
          &ldquo;Technology should empower everyone — not just those without disabilities.&rdquo;
        </motion.p>
      </div>
    </section>
  );
}
