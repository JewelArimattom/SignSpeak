"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { FormEvent, useState } from "react";
import AuthCard from "@/components/auth/AuthCard";
import { login, saveToken } from "@/lib/authApi";

// Static admin credentials
const ADMIN_EMAIL = "admin@signspeak.com";
const ADMIN_PASSWORD = "Admin@123";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    // Admin shortcut
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      localStorage.setItem("admin-session", "true");
      setSuccessMessage("Welcome, Admin! Redirecting to dashboard...");
      setTimeout(() => router.push("/admin"), 800);
      return;
    }

    setSubmitting(true);
    try {
      const result = await login({ email, password });
      saveToken(result.access_token);
      setSuccessMessage(`Welcome back, ${result.user.full_name}! Redirecting...`);
      setTimeout(() => { router.push("/"); }, 900);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Welcome Back"
      subtitle="Sign in to continue using SignSpeak across devices."
      footerText="Don't have an account?"
      footerLinkText="Create one"
      footerLinkHref="/signup"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Password
            </label>
            <Link href="/signup" className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">
              Need an account?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-green-400/30 bg-green-500/10 px-3 py-2 text-sm text-green-200">
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-white text-black px-3 py-2.5 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40 transition-colors"
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </AuthCard>
  );
}
