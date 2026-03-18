"use client";

import React, { useEffect, useState } from "react";
import LandingNav from "@/components/landing/LandingNav";
import HeroBackground from "@/components/HeroBackground";
import HeroSection from "@/components/landing/HeroSection";
import FeatureShowcase from "@/components/landing/FeatureShowcase";
import HowItWorks from "@/components/landing/HowItWorks";
import AccessibilityImpact from "@/components/landing/AccessibilityImpact";
import LiveDemoSection from "@/components/landing/LiveDemoSection";
import CommunityShowcase from "@/components/landing/CommunityShowcase";
import CtaSection from "@/components/landing/CtaSection";

export default function LandingPage() {
  const [eyeControlEnabled, setEyeControlEnabled] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("eye-control-enabled");
    if (saved === "true") setEyeControlEnabled(true);
  }, []);

  const handleEyeControlToggle = (enabled: boolean) => {
    setEyeControlEnabled(enabled);
    window.localStorage.setItem("eye-control-enabled", String(enabled));
    window.dispatchEvent(new Event("eye-control-toggle"));
  };

  return (
    <main className="min-h-screen flex flex-col">
      <LandingNav />

      {/* Hero */}
      <section className="flex-1 relative overflow-hidden">
        <HeroBackground />
        <HeroSection
          eyeControlEnabled={eyeControlEnabled}
          onToggleEyeControl={handleEyeControlToggle}
        />
      </section>

      {/* Divider */}
      <div className="section-divider mx-auto w-full max-w-5xl px-4" />

      {/* Feature Showcase */}
      <FeatureShowcase />

      <div className="section-divider mx-auto w-full max-w-5xl px-4" />

      {/* AI Pipeline */}
      <HowItWorks />

      <div className="section-divider mx-auto w-full max-w-5xl px-4" />

      {/* Accessibility Impact */}
      <AccessibilityImpact />

      <div className="section-divider mx-auto w-full max-w-5xl px-4" />

      {/* Live Demo */}
      <LiveDemoSection />

      <div className="section-divider mx-auto w-full max-w-5xl px-4" />

      {/* Community */}
      <CommunityShowcase />

      <div className="section-divider mx-auto w-full max-w-5xl px-4" />

      {/* Final CTA */}
      <CtaSection />

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-white/20 border-t border-white/5">
        <p>SignSpeak — Hand Gesture Recognition · Built with Next.js + FastAPI + PostgreSQL</p>
      </footer>
    </main>
  );
}
