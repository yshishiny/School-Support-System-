"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { answerQuestionAction, finishAttemptAction, type AnswerResult, type FinishResult } from "@/lib/actions/learning";

export interface RunnerQuestion {
  id: string;
  prompt: string;
  choices: string[];
  passage?: string | null;
}

const LETTERS = ["A", "B", "C", "D"];

export function QuizRunner({
  attemptId: initialAttemptId,
  quizId,
  questions,
  passage,
  paceSeconds,
  kind,
  backHref,
  title,
  deadlineMs = null,
}: {
  attemptId: string | null;
  quizId?: string;
  questions: RunnerQuestion[];
  passage: string | null;
  paceSeconds: number | null;
  kind: "quiz" | "review";
  backHref: string;
  title: string;
  deadlineMs?: number | null; // checkpoint clock: auto-finishes when it runs out
}) {
  const [attemptId, setAttemptId] = useState<string | null>(initialAttemptId);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const tabSwitches = useRef(0);
  const correctCount = useRef(0);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") tabSwitches.current += 1;
    };
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, []);

  const q = questions[index];
  const shownPassage = q?.passage ?? passage;
  const [now, setNow] = useState(Date.now());
  const finishing = useRef(false);
  useEffect(() => {
    if (deadlineMs === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadlineMs]);
  const remaining = deadlineMs === null ? null : Math.max(0, Math.round((deadlineMs - now) / 1000));
  useEffect(() => {
    if (remaining !== 0 || result || finishing.current) return;
    finishing.current = true;
    (async () => {
      try {
        if (attemptId) setResult(await finishAttemptAction(attemptId, tabSwitches.current, questions.length));
        else setError("Time is up before any answer was saved.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not finish.");
      }
    })();
  }, [remaining, result, attemptId, questions.length]);

  async function choose(i: number) {
    if (feedback || busy) return;
    setBusy(true);
    setError(null);
    try {
      const seconds = (Date.now() - startRef.current) / 1000;
      const r = await answerQuestionAction(attemptId, q.id, i, seconds, quizId);
      setAttemptId(r.attemptId);
      if (r.correct) correctCount.current += 1;
      setChosen(i);
      setFeedback(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the answer.");
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setChosen(null);
      setFeedback(null);
      startRef.current = Date.now();
      setElapsed(0);
      return;
    }
    setBusy(true);
    try {
      if (!attemptId) throw new Error("No answers recorded.");
      setResult(await finishAttemptAction(attemptId, tabSwitches.current, questions.length));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div className="card text-center space-y-3">
        <div className="text-5xl">{pct >= 80 ? "🏆" : pct >= 50 ? "💪" : "📚"}</div>
        <p className="h2">{result.score} / {result.total} correct</p>
        <p className="text-3xl font-extrabold text-accent-2">+{result.earned} points</p>
        {result.flag && <p className="text-sm text-warn">⚠️ {result.flag}. No points this time, and your parent can see it.</p>}
        <p className="muted text-sm">Missed questions come back in your Review queue tomorrow.</p>
        <div className="flex gap-2 justify-center">
          <Link href={backHref} className="btn-ghost">Back</Link>
          <Link href="/learn" className="btn-primary">Keep learning</Link>
        </div>
      </div>
    );
  }

  if (!q) return <p className="card muted">No questions.</p>;
  const over = paceSeconds !== null && elapsed > paceSeconds;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm muted">
        <span>{title}</span>
        <span>{remaining !== null && <span className={`badge mr-2 ${remaining < 120 ? "text-warn" : ""}`}>⏳ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>}{index + 1} / {questions.length}</span>
      </div>
      {deadlineMs !== null && index === 0 && !feedback && <p className="text-xs text-warn">Checkpoint: one attempt, the clock is running, answers save as you go. Unanswered questions count as wrong when time runs out.</p>}
      <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-accent to-accent-2 transition-all" style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>

      {shownPassage && (
        <details className="card" open={index === 0}>
          <summary className="cursor-pointer font-semibold">Passage</summary>
          <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{shownPassage}</p>
        </details>
      )}

      <div className="card space-y-3">
        <div className="flex justify-between items-start gap-3">
          <p className="font-medium whitespace-pre-wrap leading-relaxed">{q.prompt}</p>
          {paceSeconds !== null && (
            <span className={`badge shrink-0 ${over ? "text-warn" : ""}`} title="ACT pace">
              ⏱ {elapsed}s{over ? ` / ${paceSeconds}s` : ""}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {q.choices.map((c, i) => {
            let cls = "border-line hover:border-accent";
            if (feedback) {
              if (i === feedback.correct_index) cls = "border-good bg-good/15";
              else if (i === chosen) cls = "border-bad bg-bad/15";
              else cls = "border-line opacity-60";
            }
            return (
              <button key={i} type="button" onClick={() => choose(i)} disabled={!!feedback || busy} className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${cls}`}>
                <span className="muted mr-2 font-mono">{LETTERS[i]}.</span>
                <span className="whitespace-pre-wrap">{c}</span>
              </button>
            );
          })}
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
        {feedback && (
          <div className={`rounded-xl p-3 text-sm ${feedback.correct ? "bg-good/10 border border-good/40" : "bg-bad/10 border border-bad/40"}`}>
            <p className="font-semibold mb-1">{feedback.correct ? "Correct ✅" : "Not quite ❌"}</p>
            <p className="whitespace-pre-wrap leading-relaxed">{feedback.explanation}</p>
          </div>
        )}
        {feedback && (
          <button type="button" onClick={next} disabled={busy} className="btn-primary w-full">
            {busy ? "Saving…" : index + 1 < questions.length ? "Next →" : "Finish"}
          </button>
        )}
      </div>
    </div>
  );
}
