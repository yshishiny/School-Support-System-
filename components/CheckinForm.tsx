"use client";

import { useRef, useState, useTransition } from "react";
import { submitCheckinAction, type CheckinResult } from "@/lib/actions/checkin";
import { KIND_EMOJI, type Assignment, type Checkin, type ItemStatus } from "@/lib/types";
import { relativeLabel } from "@/lib/dates";
import { Notice } from "./ui";

const MOODS = [
  { v: 1, e: "😞" },
  { v: 2, e: "😕" },
  { v: 3, e: "😐" },
  { v: 4, e: "🙂" },
  { v: 5, e: "😄" },
];

export function CheckinForm({
  items,
  today,
  existing,
  existingItems,
  todaySubjects,
  existingNotes,
}: {
  items: Assignment[];
  today: string;
  existing: Checkin | null;
  existingItems: Record<string, ItemStatus>;
  todaySubjects: string[];
  existingNotes: Record<string, string>;
}) {
  const [state, setState] = useState<CheckinResult | undefined>(undefined);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    setState(undefined);
    start(async () => {
      try {
        setState(await submitCheckinAction(undefined, fd));
      } catch (err) {
        setState({ error: `Could not save (${err instanceof Error ? err.message : String(err)}). Reload the page and try again; what you typed is still here.` });
      }
    });
  }

  if (state?.earned !== undefined) {
    return (
      <div className="card text-center space-y-2">
        <div className="text-5xl">🎉</div>
        <p className="h2">Check-in saved!</p>
        <p className="text-3xl font-extrabold text-accent-2">+{state.earned} points</p>
        <p className="muted text-sm">Streak: {state.streak} day{state.streak === 1 ? "" : "s"} 🔥</p>
        <a href="/today" className="btn-ghost w-full">Back to today</a>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className="card space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="h2">{existing ? "Update today's check-in" : "Today's check-in"}</h2>
        {existing && <span className="badge text-good">✓ submitted</span>}
      </div>

      {items.length === 0 ? (
        <p className="muted text-sm">Nothing is due today. Add homework below if the teacher gave some.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm muted">Mark each task honestly. Partial is fine, lying is not.</p>
          {items.map((a) => (
            <div key={a.id} className="rounded-xl border border-line p-3 space-y-2 bg-panel-2/40">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    {KIND_EMOJI[a.kind]} {a.title}
                  </div>
                  <div className="text-xs muted">
                    {a.subject_name ?? ""} {a.subject_name ? "·" : ""} {relativeLabel(a.due_date, today)}
                  </div>
                  {a.details && <div className="text-xs muted mt-1 whitespace-pre-line">{a.details}</div>}
                </div>
              </div>
              <div className="seg">
                {(["done", "partial", "not_done"] as ItemStatus[]).map((s) => (
                  <label key={s}>
                    <input type="radio" name={`item_${a.id}`} value={s} defaultChecked={(existingItems[a.id] ?? "not_done") === s} />
                    <span>{s === "done" ? "Done ✅" : s === "partial" ? "Partly 🟡" : "Not yet ❌"}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {todaySubjects.length > 0 && (
        <div className="space-y-2">
          <label className="label">What did you take in each class today? One line each · +2 pts per subject</label>
          {todaySubjects.map((subject) => (
            <div key={subject} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm font-medium truncate" title={subject}>{subject}</span>
              <input name={`lesson_${subject}`} className="input py-2 text-sm" placeholder="e.g. quadratic formula, chapter 3" defaultValue={existingNotes[subject] ?? ""} maxLength={500} />
            </div>
          ))}
          <p className="text-xs muted">After you submit, you can take a quick recall quiz on exactly these lessons.</p>
        </div>
      )}

      <div>
        <label className="label">How was today?</label>
        <div className="flex gap-2">
          {MOODS.map((m) => (
            <label key={m.v} className="flex-1">
              <input type="radio" name="mood" value={m.v} className="peer sr-only" defaultChecked={existing?.mood === m.v} />
              <span className="block text-center text-2xl rounded-xl border border-line py-2 peer-checked:border-accent peer-checked:bg-accent/20 cursor-pointer">{m.e}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Minutes studied (outside school)</label>
        <input name="minutes_studied" type="number" min={0} max={600} step={5} className="input" defaultValue={existing?.minutes_studied ?? 30} />
      </div>

      <div>
        <label className="label">What did you learn today? (one or two sentences, your own words)</label>
        <textarea name="learned" className="input" rows={3} defaultValue={existing?.learned ?? ""} placeholder="e.g. In math we did the quadratic formula. In bio, how mitochondria make ATP." />
      </div>

      <div>
        <label className="label">Anything you did not understand?</label>
        <textarea name="stuck_on" className="input" rows={2} defaultValue={existing?.stuck_on ?? ""} placeholder="Leave empty if everything was clear" />
      </div>

      <Notice error={state?.error} />
      <button type="submit" className="btn-primary w-full text-base" disabled={pending}>
        {pending ? "Saving…" : existing ? "Update check-in" : "Submit check-in  ·  +10 pts"}
      </button>
    </form>
  );
}
