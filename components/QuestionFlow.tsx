"use client";

import { useState, useTransition } from "react";
import type { CheckQuestion } from "@/lib/wellbeing";

/** One question per screen with big tappable options, an optional private note, then a submit. */
export function QuestionFlow({
  questions,
  freeTextPrompt,
  onSubmit,
  submitLabel = "Finish",
}: {
  questions: CheckQuestion[];
  freeTextPrompt?: string;
  onSubmit: (answers: Record<string, string>, freeText: string) => Promise<{ error?: string } | void>;
  submitLabel?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [i, setI] = useState(0);
  const [free, setFree] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const atNote = i === questions.length; // the free-text screen after the last question
  const q = questions[Math.min(i, questions.length - 1)];

  function pick(value: string) {
    setAnswers({ ...answers, [q.id]: value });
    setTimeout(() => setI(Math.min(i + 1, freeTextPrompt ? questions.length : questions.length - 1)), 160);
  }
  function submit() {
    setError(null);
    start(async () => {
      try {
        const r = await onSubmit(answers, free);
        if (r && "error" in r && r.error) setError(r.error);
      } catch (err) {
        setError(`Could not save (${err instanceof Error ? err.message : String(err)}). Reload and try again.`);
      }
    });
  }
  const lastQuestion = i === questions.length - 1 && !freeTextPrompt;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {questions.map((x, k) => (
          <button key={x.id} type="button" onClick={() => setI(k)} className={`h-2 flex-1 rounded-full ${answers[x.id] ? "bg-accent" : k === i ? "bg-accent/50" : "bg-panel-2"}`} aria-label={`Question ${k + 1}`} />
        ))}
        {freeTextPrompt && <button type="button" onClick={() => setI(questions.length)} className={`h-2 flex-1 rounded-full ${atNote ? "bg-accent/50" : "bg-panel-2"}`} aria-label="Note" />}
      </div>
      {!atNote ? (
        <div className="card space-y-3 pop" key={q.id}>
          <div className="flex items-center gap-3">
            <span className="text-5xl sticker-still">{q.emoji}</span>
            <h2 className="h2">{q.prompt}</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {q.options.map((o) => (
              <button key={o.value} type="button" onClick={() => pick(o.value)} className={`tile flex items-center gap-3 text-left ${answers[q.id] === o.value ? "border-accent bg-accent/15" : ""}`}>
                {o.emoji && <span className="text-3xl">{o.emoji}</span>}
                <span className="font-semibold">{o.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button type="button" className="text-sm muted" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>← Back</button>
            <span className="text-xs muted">{i + 1} / {questions.length}</span>
            {lastQuestion ? (
              <button type="button" className="btn-primary btn-sm" onClick={submit} disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
            ) : (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setI(i + 1)}>Skip</button>
            )}
          </div>
        </div>
      ) : (
        <div className="card space-y-3 pop">
          <div className="flex items-center gap-3">
            <span className="text-5xl sticker-still">💬</span>
            <h2 className="h2">{freeTextPrompt}</h2>
          </div>
          <textarea className="input" rows={4} value={free} onChange={(e) => setFree(e.target.value)} maxLength={1500} placeholder="Optional. Nobody else reads this. If the coach thinks you are in danger, your parents are told so they can help." />
          <div className="flex items-center justify-between">
            <button type="button" className="text-sm muted" onClick={() => setI(questions.length - 1)}>← Back</button>
            <button type="button" className="btn-primary" onClick={submit} disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
