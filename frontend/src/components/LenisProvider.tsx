"use client";

import { useEffect } from "react";

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let animFrameId: number;

    import("lenis").then(({ default: Lenis }) => {
      const lenis = new Lenis({
        duration: 1.1,
        smoothWheel: true,
        wheelMultiplier: 0.8,
      });

      const animate = (time: number) => {
        lenis.raf(time);
        animFrameId = requestAnimationFrame(animate);
      };
      animFrameId = requestAnimationFrame(animate);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__lenis = lenis;
    });

    return () => {
      cancelAnimationFrame(animFrameId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lenis = (window as any).__lenis;
      if (lenis) {
        lenis.destroy();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any).__lenis;
      }
    };
  }, []);

  return <>{children}</>;
}
