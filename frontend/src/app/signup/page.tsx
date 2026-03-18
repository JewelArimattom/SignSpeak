"use client";

import { useRouter } from "next/navigation";
import React, { FormEvent, useState } from "react";
import AuthCard from "@/components/auth/AuthCard";
import { saveToken, signup } from "@/lib/authApi";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter a valid email.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await signup({ full_name: fullName, email, password });
      saveToken(result.access_token);
      setSuccessMessage("Account created successfully. Redirecting to home...");
      setTimeout(() => {
        router.push("/");
      }, 900);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signup failed.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Create Account"
      subtitle="Save your profile and jump into hand-sign communication."
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkHref="/login"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>

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
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
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
          {submitting ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </AuthCard>
  );
}
