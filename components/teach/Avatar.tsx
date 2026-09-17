"use client";

import type { Character } from "@/lib/characters";

/** A simple original 2D character: head, hair or hat, eyes that blink, a mouth that moves while speaking. */
export function Avatar({ c, speaking, size = 160, mood = "neutral" }: { c: Character; speaking: boolean; size?: number; mood?: "neutral" | "happy" | "think" }) {
  const mouth = speaking ? "M 62 118 Q 80 134 98 118" : mood === "happy" ? "M 60 116 Q 80 130 100 116" : "M 64 120 Q 80 124 96 120";
  return (
    <svg viewBox="0 0 160 170" width={size} height={size * 1.06} className={speaking ? "avatar-talk" : ""} aria-hidden>
      <style>{`.avatar-talk .mouth{animation:talk .28s ease-in-out infinite alternate}@keyframes talk{from{transform:scaleY(.35)}to{transform:scaleY(1)}}.blink{animation:blink 4s infinite}@keyframes blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}`}</style>
      <ellipse cx="80" cy="160" rx="54" ry="10" fill="rgba(0,0,0,.15)" />
      <rect x="40" y="120" width="80" height="50" rx="22" fill={c.colors.top} />
      <rect x="66" y="112" width="28" height="16" rx="8" fill={c.colors.skin} />
      <circle cx="80" cy="78" r="46" fill={c.colors.skin} />
      {c.hat === "cap" ? (
        <>
          <path d="M 34 66 Q 80 14 126 66 Z" fill={c.colors.accent === "#ffffff" ? c.colors.top : c.colors.accent} />
          <rect x="30" y="62" width="100" height="10" rx="5" fill={c.colors.hair} />
        </>
      ) : c.hat === "scarf" ? (
        <path d="M 30 70 Q 80 10 130 70 L 130 92 Q 80 60 30 92 Z" fill={c.colors.accent} />
      ) : (
        <path d="M 34 70 Q 40 22 80 26 Q 120 22 126 70 Q 100 52 80 56 Q 60 52 34 70 Z" fill={c.colors.hair} />
      )}
      <g className="blink" style={{ transformOrigin: "80px 78px" }}>
        <ellipse cx="62" cy="80" rx="6" ry="7" fill="#1b1b1b" />
        <ellipse cx="98" cy="80" rx="6" ry="7" fill="#1b1b1b" />
        <circle cx="64" cy="78" r="2" fill="#fff" />
        <circle cx="100" cy="78" r="2" fill="#fff" />
      </g>
      <path d="M 52 66 Q 62 60 72 66" stroke="#1b1b1b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M 88 66 Q 98 60 108 66" stroke="#1b1b1b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path className="mouth" style={{ transformOrigin: "80px 122px" }} d={mouth} stroke="#7a2e2e" strokeWidth="4" fill={speaking ? "#7a2e2e" : "none"} strokeLinecap="round" />
      <circle cx="46" cy="98" r="6" fill={c.colors.accent} opacity=".35" />
      <circle cx="114" cy="98" r="6" fill={c.colors.accent} opacity=".35" />
    </svg>
  );
}
