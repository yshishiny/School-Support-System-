"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Teacher } from "./Teacher";
import { chooseCharacterAction } from "@/lib/actions/teach";
import { CHARACTERS, type Character } from "@/lib/characters";
import type { Gesture } from "@/lib/teach/performance";

/** The child meets each teacher full-size: tap to hear them, choose one for all subjects, change any time. */
export function CharacterPicker({ current, onChoose }: { current: string | null; onChoose?: (id: string) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [active, setActive] = useState<string | null>(null);
  const [gesture, setGesture] = useState<Gesture>("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  function meet(c: Character) {
    setActive(c.id); setGesture("wave");
    if (timer.current) window.clearTimeout(timer.current);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(c.lines.hello);
      u.lang = "en-US"; u.rate = c.voice.rate; u.pitch = c.voice.pitch;
      u.onend = () => setGesture("idle");
      window.speechSynthesis.speak(u);
    }
    timer.current = window.setTimeout(() => setGesture("idle"), 4000);
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {CHARACTERS.map((c) => {
        const on = active === c.id;
        return (
          <div key={c.id} className={`card !p-3 space-y-2 text-center ${current === c.id ? "border-accent" : ""}`}>
            <button type="button" className="w-full flex justify-center" onClick={() => meet(c)} aria-label={`Meet ${c.name}`}>
              <Teacher c={c} size={150} gesture={on ? gesture : "idle"} mood={on || current === c.id ? "happy" : "neutral"} viseme={on && gesture === "wave" ? "open" : "rest"} />
            </button>
            <div className="font-bold">{c.emoji} {c.name}</div>
            <div className="text-xs muted">{c.tagline}</div>
            {current === c.id ? (
              <div className="text-xs text-good font-bold">✓ your teacher</div>
            ) : (
              <button type="button" disabled={pending} className="btn-primary btn-sm w-full" onClick={() => start(async () => { if (onChoose) { onChoose(c.id); return; } await chooseCharacterAction(c.id); router.refresh(); })}>{pending && on ? "…" : "Choose"}</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
