"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearToken, getMe, getToken } from "@/lib/authApi";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative text-sm text-zinc-400 hover:text-white transition-colors duration-200 group"
    >
      {children}
      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-px w-0 bg-[#60a5fa] group-hover:w-full transition-all duration-300" />
    </Link>
  );
}

export default function LandingNav() {
  const [userName, setUserName] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { setUserName(null); return; }
    let mounted = true;
    (async () => {
      try {
        const me = await getMe(token);
        if (mounted) setUserName(me.full_name);
      } catch {
        if (mounted) setUserName(null);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <header className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4">
      <nav
        className={`flex items-center justify-between rounded-full border transition-all duration-300 ${
          scrolled
            ? "px-5 py-2 bg-black/90 border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
            : "px-6 py-3 bg-black/60 border-white/8"
        } backdrop-blur-xl`}
      >
        {/* Logo */}
        <Link href="/" className="text-white font-bold tracking-tight text-lg">
          SignSpeak
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-7">
          <NavLink href="/">Home</NavLink>
          <NavLink href="/eye-control">Eye Typing</NavLink>
          <NavLink href="/hand-sign">Hand Sign</NavLink>
          <NavLink href="/community">Community</NavLink>
        </div>

        {/* Auth */}
        <div className="flex items-center gap-2">
          {userName && (
            <span className="hidden sm:block px-3 py-1.5 rounded-full text-xs text-zinc-400 border border-white/8">
              {userName}
            </span>
          )}
          {!userName ? (
            <>
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-full text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="px-4 py-1.5 rounded-full text-sm font-semibold bg-white text-black hover:bg-zinc-200 transition-colors"
              >
                Sign Up
              </Link>
            </>
          ) : (
            <button
              onClick={() => { clearToken(); setUserName(null); window.location.href = "/login"; }}
              className="px-3 py-1.5 rounded-full text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
