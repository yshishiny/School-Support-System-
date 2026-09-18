"use client";

import { useEffect, useState } from "react";

const COLORS = ["#ffd166", "#7c5cff", "#22d3ee", "#34d399", "#ff8fa3", "#ffffff"];

/** A burst of paper for a right answer or a finished lesson. Client-only so the random layout never hydrates wrong. */
export function Confetti({ burst }: { burst: number }) {
  const [bits, setBits] = useState<{ id: number; x: number; d: number; r: number; c: string; s: number }[]>([]);
  useEffect(() => {
    if (!burst) return;
    const id = burst;
    setBits(Array.from({ length: 42 }, (_, i) => ({ id: id * 100 + i, x: 5 + Math.random() * 90, d: Math.random() * 0.5, r: Math.random() * 360, c: COLORS[i % COLORS.length], s: 0.7 + Math.random() * 0.8 })));
    const t = window.setTimeout(() => setBits([]), 2600);
    return () => window.clearTimeout(t);
  }, [burst]);
  if (!bits.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-30" aria-hidden>
      {bits.map((b) => <span key={b.id} className="confetti" style={{ left: `${b.x}%`, animationDelay: `${b.d}s`, background: b.c, transform: `rotate(${b.r}deg) scale(${b.s})` }} />)}
    </div>
  );
}
