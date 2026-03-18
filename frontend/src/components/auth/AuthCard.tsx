"use client";

import Link from "next/link";
import React from "react";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
};

export default function AuthCard({
  title,
  subtitle,
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
}: AuthCardProps) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-white opacity-[0.025] blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-sm text-zinc-400 hover:text-white transition-colors mb-6"
        >
          ← Back Home
        </Link>

        <section className="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{title}</h1>
            <p className="text-sm text-zinc-500">{subtitle}</p>
          </div>

          {children}

          <p className="text-sm text-zinc-500 mt-6 text-center">
            {footerText}{" "}
            <Link href={footerLinkHref} className="text-white hover:underline underline-offset-2">
              {footerLinkText}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
