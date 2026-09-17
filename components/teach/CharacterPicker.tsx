"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { chooseCharacterAction } from "@/lib/actions/teach";
import { CHARACTERS } from "@/lib/characters";

/** The child picks one teacher for all subjects; can change any time. */
export function CharacterPicker({ current }: { current: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-2 gap-3">
      {CHARACTERS.map((c) => (
        <button key={c.id} type="button" disabled={pending} onClick={() => start(async () => { await chooseCharacterAction(c.id); router.refresh(); })} onMouseEnter={() => setPreview(c.id)} onMouseLeave={() => setPreview(null)} className={`card text-left space-y-1 !p-3 ${current === c.id ? "border-accent" : ""}`}>
          <div className="flex justify-center"><Avatar c={c} speaking={preview === c.id} size={110} mood={current === c.id ? "happy" : "neutral"} /></div>
          <div className="font-bold text-center">{c.emoji} {c.name}</div>
          <div className="text-xs muted text-center">{c.tagline}</div>
          {current === c.id && <div className="text-center text-xs text-good">✓ your teacher</div>}
        </button>
      ))}
    </div>
  );
}
