"use client";

import { useEffect, useRef } from "react";

export default function HeroBackground() {
  const gradientRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!gradientRef.current) return;
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      gradientRef.current.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(96,165,250,0.06) 0%, rgba(255,255,255,0.02) 35%, transparent 65%)`;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Layer 1: fine grid, slow drift */}
      <div className="absolute inset-[-48px] animate-[gridMove_16s_linear_infinite]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 0%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 0%, black 40%, transparent 100%)",
        }}
      />
      {/* Layer 2: coarser grid, slower drift */}
      <div className="absolute inset-[-96px] animate-[gridMove_28s_linear_infinite]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          maskImage: "radial-gradient(ellipse 60% 50% at 50% 0%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 0%, black 30%, transparent 100%)",
        }}
      />
      {/* Layer 3: mouse-follow radial gradient */}
      <div ref={gradientRef} className="absolute inset-0 transition-[background] duration-500" />
      {/* Soft blue-white glow at top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] blur-[120px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(96,165,250,0.07) 0%, rgba(255,255,255,0.03) 50%, transparent 100%)" }}
      />
    </div>
  );
}
