"use client";

import { useMemo, useState, useTransition } from "react";
import { recordMemorizeSessionAction } from "@/lib/actions/memorize";
import type { MemorizeItem } from "@/lib/types";

type Stage = 0 | 1 | 2 | 3; // read → hide a third → hide two thirds → recite from memory

const STAGE_LABEL = ["اقرأ", "أخفِ الثلث", "أخفِ الثلثين", "من الذاكرة"];

/** Progressive hiding: words disappear stage by stage; in the last stage every word is hidden and tapping one reveals it (and costs a point). */
export function MemorizeTrainer({ item }: { item: MemorizeItem }) {
  const [stage, setStage] = useState<Stage>(0);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [showTranslation, setShowTranslation] = useState(false);
  const [result, setResult] = useState<{ earned: number; best: number; score: number } | null>(null);
  const [pending, start] = useTransition();

  const segments = useMemo(() => item.segments.map((s, si) => ({ ...s, words: s.text.split(/\s+/).filter(Boolean).map((w, wi) => ({ w, key: `${si}-${wi}` })) })), [item.segments]);
  const totalWords = segments.reduce((n, s) => n + s.words.length, 0);

  // Deterministic hiding so the same words stay hidden when the stage is revisited.
  const hiddenAt = (key: string, st: Stage) => {
    if (st === 0) return false;
    if (st === 3) return true;
    const [si, wi] = key.split("-").map(Number);
    const h = (si * 31 + wi * 17) % 3;
    return st === 1 ? h === 0 : h !== 2;
  };

  function finish() {
    const score = Math.round(((totalWords - revealed.size) / Math.max(1, totalWords)) * 100);
    start(async () => {
      const r = await recordMemorizeSessionAction(item.id, score);
      setResult({ ...r, score });
    });
  }

  if (result) {
    return (
      <div className="card text-center space-y-2">
        <div className="text-5xl">{result.score >= 95 ? "🌟" : result.score >= 70 ? "👏" : "💪"}</div>
        <p className="h2">{result.score}% من الذاكرة</p>
        <p className="text-3xl font-extrabold text-accent-2">+{result.earned} points</p>
        <p className="muted text-sm">Best so far: {result.best}%{result.earned === 0 ? " · already paid today, practice still counts" : ""}</p>
        <div className="flex gap-2 justify-center">
          <button className="btn-ghost" onClick={() => { setResult(null); setRevealed(new Set()); setStage(3); }}>Again</button>
          <a href="/learn/memorize" className="btn-primary">Back</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="seg grid-cols-4">
        {STAGE_LABEL.map((l, i) => (
          <label key={l}>
            <input type="radio" name="stage" className="sr-only" checked={stage === i} onChange={() => { setStage(i as Stage); if (i !== 3) setRevealed(new Set()); }} />
            <span className={`block py-1.5 rounded-lg text-xs ${stage === i ? "bg-accent text-white" : ""}`}>{l}</span>
          </label>
        ))}
      </div>

      <div className="card space-y-4" dir="rtl" lang="ar">
        {segments.map((s) => (
          <p key={s.ref} className="text-2xl leading-[2.2] font-serif" style={{ fontFamily: '"Amiri", "Scheherazade New", "Noto Naskh Arabic", serif' }}>
            {s.words.map(({ w, key }) => {
              const hidden = hiddenAt(key, stage) && !revealed.has(key);
              return (
                <span key={key}>
                  <button
                    type="button"
                    onClick={() => stage === 3 && setRevealed(new Set(revealed).add(key))}
                    className={hidden ? "inline-block rounded-md bg-panel-2 text-transparent select-none border border-line px-1" : "inline"}
                    style={hidden ? { minWidth: `${Math.max(1.5, w.length * 0.6)}ch` } : undefined}
                  >
                    {w}
                  </button>{" "}
                </span>
              );
            })}
            {item.kind === "quran" && <span className="text-accent-2 text-base"> ﴿{s.ref.split(":")[1]}﴾ </span>}
          </p>
        ))}
        {item.translation && (
          <div dir="ltr" className="text-sm muted">
            <button type="button" className="text-xs underline" onClick={() => setShowTranslation(!showTranslation)}>{showTranslation ? "Hide meaning" : "Show meaning"}</button>
            {showTranslation && <p className="mt-1">{item.translation}</p>}
          </div>
        )}
      </div>

      {stage === 3 ? (
        <div className="card flex items-center gap-3">
          <div className="flex-1 text-sm">
            <div className="font-semibold">Recite it, tap a word only if you are stuck.</div>
            <div className="muted text-xs">{revealed.size} of {totalWords} words peeked</div>
          </div>
          <button className="btn-primary" disabled={pending} onClick={finish}>{pending ? "Saving…" : "Done"}</button>
        </div>
      ) : (
        <p className="text-xs muted text-center">Read it a few times, then move to the next stage. The last stage pays points.</p>
      )}
    </div>
  );
}
