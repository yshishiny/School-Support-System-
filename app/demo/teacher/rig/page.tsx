"use client";

import { useState } from "react";
import { CHARACTERS } from "@/lib/characters";
import { Teacher } from "@/components/teach/Teacher";
import type { Gesture, Mood, Viseme } from "@/lib/teach/performance";

const GESTURES: Gesture[] = ["idle", "wave", "explain", "point", "write", "think", "celebrate", "listen", "oops", "bow"];
const MOODS: Mood[] = ["neutral", "happy", "think", "surprised", "encourage", "sad"];
const VISEMES: Viseme[] = ["rest", "small", "open", "wide", "round", "closed"];

/** Public rig gallery: every teacher in every pose, for tuning the animation. No data. */
export default function RigGallery() {
  const [gesture, setGesture] = useState<Gesture>("idle");
  const [mood, setMood] = useState<Mood>("neutral");
  const [viseme, setViseme] = useState<Viseme>("rest");
  const [walking, setWalking] = useState(false);
  return (
    <main className="min-h-dvh bg-[#1a2238] text-white p-4 space-y-4">
      <h1 className="h1">Teacher rig</h1>
      <div className="flex flex-wrap gap-1.5">{GESTURES.map((g) => <button key={g} type="button" className={`chip ${gesture === g ? "chip-on" : ""}`} onClick={() => setGesture(g)}>{g}</button>)}</div>
      <div className="flex flex-wrap gap-1.5">{MOODS.map((m) => <button key={m} type="button" className={`chip ${mood === m ? "chip-on" : ""}`} onClick={() => setMood(m)}>{m}</button>)}</div>
      <div className="flex flex-wrap gap-1.5">{VISEMES.map((v) => <button key={v} type="button" className={`chip ${viseme === v ? "chip-on" : ""}`} onClick={() => setViseme(v)}>{v}</button>)}<button type="button" className={`chip ${walking ? "chip-on" : ""}`} onClick={() => setWalking((w) => !w)}>walking</button></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="gallery">
        {CHARACTERS.map((c) => (
          <div key={c.id} className="card flex flex-col items-center gap-2">
            <Teacher c={c} gesture={gesture} mood={mood} viseme={viseme} walking={walking} size={200} />
            <div className="font-bold">{c.emoji} {c.name}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {CHARACTERS.map((c) => <div key={c.id} className="card flex justify-center"><Teacher c={c} crop="bust" mood="happy" size={120} /></div>)}
      </div>
    </main>
  );
}
