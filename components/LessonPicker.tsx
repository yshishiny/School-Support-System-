"use client";

import { useState, useTransition } from "react";
import { sharedChips } from "@/lib/checkin/shared";
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
    // The card stays left-to-right: its labels and buttons are English. Setting rtl on the whole card because
    // the first topic happened to be Arabic flipped the header too, so "what was the lesson?" rendered as
    // "?what was the lesson". Each Arabic string carries its own direction instead, via dir="auto".
    <div className="rounded-xl border border-line bg-panel-2/40 p-2.5 space-y-2">
      <input type="hidden" name={`lesson_${fieldKey}`} value={note} />
      <input type="hidden" name={`lessontopic_${fieldKey}`} value={topicId ?? ""} />
      <input type="hidden" name={`lessonhwgiven_${fieldKey}`} value={hwGiven} />
      <input type="hidden" name={`lessonhw_${fieldKey}`} value={hwGiven === "yes" ? hw : ""} />
      <input type="hidden" name={`lessonhwdue_${fieldKey}`} value={hwGiven === "yes" ? hwDue : ""} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold truncate"><span className="text-lg align-middle">{subjectEmoji(input.subject)}</span> {input.subject}</span>
        {note ? <span dir="auto" className={`badge truncate max-w-[60%] ${hwGiven ? "text-good" : "text-warn"}`}>{hwGiven ? "✓" : "…"} {note}</span> : <span className="text-sm muted shrink-0">what was the lesson?</span>}
      </div>

      {mode === "chips" && (
        <div className="flex flex-wrap gap-1.5">
          {suggested.map((t) => (
            <button key={t.id} type="button" dir="auto" onClick={() => choose(t.id, t.name)} className={`chip !text-sm ${topicId === t.id ? "chip-on" : ""}`}>
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

      {input.schoolShared && input.schoolShared.length > 0 && (() => {
        // Was every matching file joined into one sentence: thirteen documents and sixty-five topics under a
        // single class, repeated for every class and every missed day. Deduped, capped, and laid out as rows.
        const { chips, more } = sharedChips(input.schoolShared);
        return (
          <div className={`rounded-xl p-2.5 space-y-1.5 ${note === "No class / absent" ? "border border-warn bg-warn/10" : "bg-panel-2"}`}>
            <div className="text-sm font-semibold">🏫 The school sent these</div>
            <ul className="space-y-1">
              {chips.map((c) => (
                <li key={c.title} className="text-sm leading-snug">
                  <span className="block">{c.title}</span>
                  {c.hint.length > 0 && <span className="block text-xs muted">{c.hint.join(" · ")}</span>}
                </li>
              ))}
            </ul>
            {more > 0 && <div className="text-xs muted">and {more} more</div>}
            <div className="text-sm">
              {note === "No class / absent"
                ? <b>You said “no class”. If you did have it, pick the lesson instead — your parents see the file and your log side by side.</b>
                : "Pick the lesson that matches, or say what really happened."}
            </div>
          </div>
        );
      })()}

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
          {reply && <p className="text-sm" dir="auto">🤖 {reply}</p>}
          {guesses.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {guesses.map((g, i) => (
                <button key={i} type="button" dir="auto" onClick={() => choose(g.topic_id, g.title)} className="chip !text-sm" title={g.why}>
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
