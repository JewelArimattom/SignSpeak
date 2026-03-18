"use client";

import { motion } from "framer-motion";

const POSTS = [
  {
    initial: "A",
    name: "Alex Chen",
    role: "ML Engineer",
    content: "Just trained a custom model for 50 BSL signs with 97% accuracy. Opening it up to the community!",
    likes: 48,
    comments: 12,
    time: "2h ago",
  },
  {
    initial: "R",
    name: "Riya Patel",
    role: "Accessibility Designer",
    content: "Used SignSpeak during my entire conference presentation. No one noticed I wasn't speaking — the AI did it all.",
    likes: 124,
    comments: 31,
    time: "5h ago",
  },
  {
    initial: "K",
    name: "Kenji Mori",
    role: "Researcher",
    content: "Working on a Mandarin sign language dataset. Would love collaborators — DM me!",
    likes: 67,
    comments: 18,
    time: "1d ago",
  },
  {
    initial: "S",
    name: "Sara Williams",
    role: "Special Ed Teacher",
    content: "My non-verbal students now communicate independently for the first time. This technology changes lives.",
    likes: 203,
    comments: 44,
    time: "2d ago",
  },
];

export default function CommunityShowcase() {
  return (
    <section className="relative z-10 max-w-6xl mx-auto px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="text-center mb-12"
      >
        <span className="text-xs text-zinc-600 uppercase tracking-[0.2em] font-semibold">Community</span>
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mt-3">
          Built by everyone,<br />
          <span className="shimmer-text">for everyone</span>
        </h2>
        <p className="text-zinc-500 mt-4 max-w-xl mx-auto">
          Developers, researchers, educators, and users pushing the frontier of accessible communication.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {POSTS.map((post, i) => (
          <motion.div
            key={post.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
            className="feature-card rounded-2xl p-6 border border-white/8 hover:border-white/16 flex flex-col gap-4"
          >
            {/* Author */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-sm font-bold text-white/60">
                {post.initial}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{post.name}</p>
                <p className="text-xs text-zinc-600">{post.role}</p>
              </div>
            </div>

            {/* Content */}
            <p className="text-sm text-zinc-400 leading-relaxed flex-1">{post.content}</p>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-zinc-600 border-t border-white/6 pt-3">
              <div className="flex items-center gap-3">
                <span>♥ {post.likes}</span>
                <span>💬 {post.comments}</span>
              </div>
              <span>{post.time}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
