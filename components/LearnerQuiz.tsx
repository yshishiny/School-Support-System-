"use client";

import { useState, useTransition } from "react";
import { saveLearnerProfileAction } from "@/lib/actions/learner";
import { LEARNER_QUESTIONS, type LearnerAnswers } from "@/lib/learner";

/** One question at a time, big tappable options, no wrong answers. */
export function LearnerQuiz({ initial }: { initial: LearnerAnswers }) {
  const [answers, setAnswers] = useState<LearnerAnswers>(initial);
  const [i, setI] = useState(0);
  const [done, setDone] = useState<{ earned: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const q = LEARNER_QUESTIONS[i];
  const last = i === LEARNER_QUESTIONS.length - 1;

  function pick(value: string) {
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (!last) setTimeout(() => setI(i + 1), 180);
  }

  function finish() {
    setError(null);
    start(async () => {
      try {
        const r = await saveLearnerProfileAction(answers);
        if (r.error) setError(r.error);
        else setDone({ earned: r.earned ?? 0 });
      } catch (err) {
        setError(`Could not save (${err instanceof Error ? err.message : String(err)}). Reload and try again.`);
      }
    });
  }

  if (done) {
    return (
      <div className="card text-center space-y-2 pop">
        <div className="text-6xl sticker-still">🦸</div>
        <p className="h2">Got it. Your coach knows you now.</p>
        {done.earned > 0 && <p className="text-3xl font-extrabold text-accent-2">+{done.earned} points</p>}
        <p className="text-sm muted">Lessons, quiz explanations and the coach's notes will match how you like to learn. You can change answers any time.</p>
        <a href="/today" className="btn-primary">Back to today</a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {LEARNER_QUESTIONS.map((x, k) => (
          <button key={x.id} type="button" onClick={() => setI(k)} className={`h-2 flex-1 rounded-full ${answers[x.id] ? "bg-accent" : k === i ? "bg-accent/50" : "bg-panel-2"}`} aria-label={`Question ${k + 1}`} />
        ))}
      </div>
      <div className="card space-y-3 pop" key={q.id}>
        <div className="flex items-center gap-3">
          <span className="text-5xl sticker-still">{q.emoji}</span>
          <h2 className="h2">{q.prompt}</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((o) => (
            <button key={o.value} type="button" onClick={() => pick(o.value)} className={`tile flex items-center gap-3 text-left ${answers[q.id] === o.value ? "border-accent bg-accent/15" : ""}`}>
              <span className="text-3xl">{o.emoji}</span>
              <span className="font-semibold">{o.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <button type="button" className="text-sm muted" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>← Back</button>
          <span className="text-xs muted">{i + 1} / {LEARNER_QUESTIONS.length}</span>
          {last ? (
            <button type="button" className="btn-primary btn-sm" onClick={finish} disabled={pending || Object.keys(answers).length < 5}>{pending ? "Saving…" : "Finish"}</button>
          ) : (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setI(i + 1)}>Skip</button>
          )}
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
      </div>
    </div>
  );
}
