"use client";

import { useState, useTransition } from "react";
import { guessLessonAction } from "@/lib/actions/lessons";
import type { LessonSubjectInput } from "@/lib/lessons";
import { subjectEmoji } from "@/lib/plan";

/**
 * One class on the check-in form: tap the lesson title from the curriculum, pick from the full list,
 * type your own, or ask the AI helper with a vague hint. Writes two hidden fields for the server action.
 */
export function LessonPicker({ fieldKey, input }: { fieldKey: string; input: LessonSubjectInput }) {
  const [note, setNote] = useState(input.existingNote ?? "");
  const [topicId, setTopicId] = useState<string | null>(input.existingTopicId);
  const [hwGiven, setHwGiven] = useState<"" | "yes" | "no">(input.existingHomeworkGiven === null ? "" : input.existingHomeworkGiven ? "yes" : "no");
  const [hw, setHw] = useState(input.existingHomework ?? "");
  const [hwDue, setHwDue] = useState(input.existingHomeworkDue ?? input.defaultHomeworkDue);
  const [mode, setMode] = useState<"chips" | "list" | "other" | "ask">("chips");
  const [hint, setHint] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<{ topic_id: string | null; title: string; why: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const byId = new Map(input.topics.map((t) => [t.id, t]));
  const suggested = input.suggested.map((id) => byId.get(id)).filter((t): t is NonNullable<typeof t> => !!t);

  function choose(id: string | null, title: string) {
    setTopicId(id);
    setNote(title);
    setMode("chips");
  }

  function ask() {
    setError(null);
    start(async () => {
      try {
        const r = await guessLessonAction(input.subject, hint);
        if ("error" in r) setError(r.error);
        else {
          setReply(r.reply);
          setGuesses(r.suggestions);
        }
      } catch (err) {
        setError(`Could not ask (${err instanceof Error ? err.message : String(err)}). Reload and try again.`);
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-panel-2/40 p-2.5 space-y-2" dir={/[\u0600-\u06FF]/.test(input.topics[0]?.name ?? "") ? "rtl" : undefined}>
      <input type="hidden" name={`lesson_${fieldKey}`} value={note} />
      <input type="hidden" name={`lessontopic_${fieldKey}`} value={topicId ?? ""} />
      <input type="hidden" name={`lessonhwgiven_${fieldKey}`} value={hwGiven} />
      <input type="hidden" name={`lessonhw_${fieldKey}`} value={hwGiven === "yes" ? hw : ""} />
      <input type="hidden" name={`lessonhwdue_${fieldKey}`} value={hwGiven === "yes" ? hwDue : ""} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold truncate"><span className="text-lg align-middle">{subjectEmoji(input.subject)}</span> {input.subject}</span>
        {note ? <span className={`badge truncate max-w-[60%] ${hwGiven ? "text-good" : "text-warn"}`}>{hwGiven ? "✓" : "…"} {note}</span> : <span className="text-xs muted">what was the lesson?</span>}
      </div>

      {mode === "chips" && (
        <div className="flex flex-wrap gap-1.5">
          {suggested.map((t) => (
            <button key={t.id} type="button" onClick={() => choose(t.id, t.name)} className={`chip ${topicId === t.id ? "chip-on" : ""}`}>
              {t.name}
            </button>
          ))}
          {input.topics.length > suggested.length && (
            <button type="button" onClick={() => setMode("list")} className="chip">More…</button>
          )}
          <button type="button" onClick={() => setMode("other")} className="chip">✏️ Other</button>
          <button type="button" onClick={() => setMode("ask")} className="chip">🤖 Not sure</button>
          <button type="button" onClick={() => { choose(null, "No class / absent"); setHwGiven("no"); }} className={`chip ${note === "No class / absent" ? "chip-on" : ""}`}>🚫 No class</button>
        </div>
      )}

      {note && note !== "No class / absent" && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold">Homework given?</span>
            <button type="button" onClick={() => setHwGiven("yes")} className={`chip ${hwGiven === "yes" ? "chip-on" : ""}`}>📝 Yes</button>
            <button type="button" onClick={() => setHwGiven("no")} className={`chip ${hwGiven === "no" ? "chip-on" : ""}`}>👍 No</button>
          </div>
          {hwGiven === "yes" && (
            <div className="flex flex-wrap gap-2">
              <input className="input py-1.5 text-sm flex-1 min-w-[10rem]" placeholder="What exactly? p.45 ex 1-10, worksheet…" value={hw} maxLength={200} onChange={(e) => setHw(e.target.value)} />
              <label className="flex items-center gap-1 text-xs muted">due <input type="date" className="input py-1.5 text-sm !w-auto" value={hwDue} onChange={(e) => setHwDue(e.target.value)} /></label>
            </div>
          )}
          {hwGiven === "" && <p className="text-[11px] text-warn">Answer yes or no so the class counts.</p>}
        </div>
      )}

      {mode === "list" && (
        <div className="space-y-1">
          <select
            className="input py-2 text-sm"
            defaultValue={topicId ?? ""}
            onChange={(e) => {
              const t = byId.get(e.target.value);
              if (t) choose(t.id, t.name);
            }}
          >
            <option value="">Pick the lesson…</option>
            {input.topics.map((t) => (
              <option key={t.id} value={t.id}>{t.unit ? `${t.unit} · ` : ""}{t.name}</option>
            ))}
          </select>
          <button type="button" className="text-xs muted" onClick={() => setMode("chips")}>← back</button>
        </div>
      )}

      {mode === "other" && (
        <div className="flex gap-2">
          <input
            className="input py-2 text-sm"
            placeholder="Write the lesson title in your words"
            defaultValue={topicId ? "" : note}
            maxLength={200}
            onChange={(e) => {
              setTopicId(null);
              setNote(e.target.value);
            }}
          />
          <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => setMode("chips")}>OK</button>
        </div>
      )}

      {mode === "ask" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              className="input py-2 text-sm"
              placeholder='A hint: "something with triangles", "the cells one"'
              value={hint}
              maxLength={200}
              onChange={(e) => setHint(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  ask();
                }
              }}
            />
            <button type="button" className="btn-primary btn-sm shrink-0" onClick={ask} disabled={pending || hint.trim().length < 2}>
              {pending ? "Thinking…" : "Ask"}
            </button>
          </div>
          {reply && <p className="text-sm">🤖 {reply}</p>}
          {guesses.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {guesses.map((g, i) => (
                <button key={i} type="button" onClick={() => choose(g.topic_id, g.title)} className="chip" title={g.why}>
                  {g.title}
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-xs text-bad">{error}</p>}
          <button type="button" className="text-xs muted" onClick={() => setMode("chips")}>← back</button>
        </div>
      )}
    </div>
  );
}
