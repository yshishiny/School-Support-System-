"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerCompensationAction, markCompensationReadAction } from "@/lib/actions/compensation";
import { runAction } from "@/lib/client-action";
import type { CompensationRow } from "@/lib/compensation";

/** Read two ayahs, then one question. Right answer: the late entry counts. */
export function CompensationCard({ c }: { c: CompensationRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [read, setRead] = useState(!!c.read_at);
  const [result, setResult] = useState<{ correct: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section className="card space-y-3 border-warn/60">
      <div className="flex items-center gap-2">
        <span className="text-2xl">📿</span>
        <div className="flex-1 text-sm"><b>Balance a late entry:</b> {c.label}</div>
        <span className="badge text-warn">{c.attempts ? `try ${c.attempts + 1}` : "2 ayahs + 1 question"}</span>
      </div>
      <div className="space-y-2" dir="rtl" lang="ar">
        {c.verses.map((v) => (
          <div key={v.ref} className="tile space-y-1">
            <div className="text-xl leading-loose" style={{ fontFamily: "var(--font-arabic)" }}>{v.text} <span className="text-xs muted">﴿{v.ref.split(":")[1]}﴾</span></div>
            {v.translation && <div className="text-xs muted" dir="ltr">{v.translation}</div>}
          </div>
        ))}
      </div>
      {!read ? (
        <button type="button" className="btn-primary w-full" disabled={pending} onClick={() => start(async () => { await runAction(() => markCompensationReadAction(c.id), setMsg); setRead(true); })}>I read them out loud, slowly</button>
      ) : result?.correct ? (
        <div className="rounded-xl border border-good/50 bg-good/10 p-2.5 text-sm">✅ Right. The late entry now counts. +1 ★</div>
      ) : (
        <div className="space-y-2">
          <div className="font-semibold" dir="rtl" lang="ar" style={{ fontFamily: "var(--font-arabic)" }}>{c.question.prompt}</div>
          <div className="grid grid-cols-2 gap-2" dir="rtl">
            {c.question.choices.map((ch, i) => (
              <button key={i} type="button" disabled={pending} className="btn-ghost text-base" style={{ fontFamily: "var(--font-arabic)" }} onClick={() => start(async () => { const r = await runAction(() => answerCompensationAction(c.id, i), setMsg); if (!r) return; setResult(r); if (r.correct) router.refresh(); })}>{ch}</button>
            ))}
          </div>
          {result && !result.correct && <div className="text-sm text-bad">Not that one. Read the two ayahs again and try once more.</div>}
        </div>
      )}
      {msg && <div className="text-xs text-bad">{msg}</div>}
    </section>
  );
}
