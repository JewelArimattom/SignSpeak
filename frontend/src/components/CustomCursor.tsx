"use client";

import { useEffect, useRef, useState } from "react";

export default function CustomCursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);   // on interactive elements → grows
  const [onCard, setOnCard]   = useState(false);   // on cards → accent glow
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    let raf: number;
    let targetX = -100, targetY = -100;
    let currentX = -100, currentY = -100;

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible) setVisible(true);
    };

    const onDown = () => setClicked(true);
    const onUp   = () => setClicked(false);

    const classify = (e: Event, entering: boolean) => {
      const el = e.target as HTMLElement;
      if (el.matches("a, button, [role='button'], input, textarea, select, label")) {
        setHovered(entering);
        if (entering) setOnCard(false);
      } else if (el.closest(".feature-card")) {
        setOnCard(entering);
        if (entering) setHovered(false);
      } else if (!entering) {
        setHovered(false);
        setOnCard(false);
      }
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      if (ringRef.current) {
        ringRef.current.style.left = `${currentX}px`;
        ringRef.current.style.top  = `${currentY}px`;
      }
      if (dotRef.current) {
        dotRef.current.style.left = `${targetX}px`;
        dotRef.current.style.top  = `${targetY}px`;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup",   onUp);
    document.addEventListener("mouseover", (e) => classify(e, true));
    document.addEventListener("mouseout",  (e) => classify(e, false));

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup",   onUp);
    };
  }, [visible]);

  if (!visible) return null;

  const scale = clicked ? 0.7 : hovered ? 1.7 : onCard ? 1.3 : 1;

  return (
    <>
      <div
        ref={ringRef}
        className={`cursor-ring${onCard ? " cursor-on-card" : ""}`}
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      />
      <div
        ref={dotRef}
        className="cursor-dot"
        style={{ transform: "translate(-50%, -50%)" }}
      />
    </>
  );
}
