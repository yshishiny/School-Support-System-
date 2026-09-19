"use client";

import { useState } from "react";
import type { PlannerDay } from "@/app/(student)/calendar/page";

/**
 * Two weeks as a strip of days you tap, so the whole plan fits on one screen instead of a page nobody scrolls.
 * A day with nothing in it is still shown, greyed, because "no school today" is an answer too.
 */
export function PlannerDays({ days }: { days: PlannerDay[] }) {
  const [pick, setPick] = useState(0);
  const d = days[pick] ?? days[0];
  const count = (x: PlannerDay) => x.classes.length + x.quizzes.filter((q) => !q.done).length + x.due.length;

  return (
    <section className="space-y-2">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {days.map((x, k) => {
          const n = count(x);
          const on = k === pick;
          return (
            <button
              key={x.date}
              type="button"
              onClick={() => setPick(k)}
              className={`min-h-16 w-14 shrink-0 rounded-2xl border px-1 py-1.5 text-center transition ${on ? "border-accent bg-accent/20" : n ? "border-line bg-panel-2" : "border-line/60 bg-panel-2/40 opacity-60"}`}
              aria-pressed={on}
            >
              <div className="text-[10px] font-bold uppercase tracking-wide">{x.short}</div>
              <div className="text-lg font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{Number(x.date.slice(8, 10))}</div>
              <div className="flex justify-center gap-0.5">
                {x.due.length > 0 && <i className="h-1.5 w-1.5 rounded-full bg-warn" />}
                {x.quizzes.some((q) => !q.done) && <i className="h-1.5 w-1.5 rounded-full bg-accent-2" />}
                {x.classes.length > 0 && <i className="h-1.5 w-1.5 rounded-full bg-muted" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="card !py-3 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="h2">{d.label}</h2>
          <span className="text-xs muted">{d.isToday ? "today" : d.date}</span>
        </div>

        {d.due.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-warn">Due</div>
            {d.due.map((a) => <div key={a.id} className="text-sm">{a.emoji} {a.title}{a.subject ? <span className="muted"> · {a.subject}</span> : null}</div>)}
          </div>
        )}

        {d.quizzes.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-accent-2">Quiz booked</div>
            {d.quizzes.map((q) => (
              <a key={q.id} href={`/quiz/${q.id}`} className="block text-sm underline decoration-dotted">
                {q.done ? "✅" : "⚡"} {q.title}
              </a>
            ))}
          </div>
        )}

        {d.classes.length > 0 ? (
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider muted">Classes</div>
            {d.classes.map((c, k) => (
              <div key={`${c.subject}-${k}`} className="flex items-center gap-2 text-sm">
                <span className="w-12 shrink-0 tabular-nums muted">{c.start}</span>
                <span className="flex-1 min-w-0 truncate font-semibold">{c.subject}</span>
                {c.room && <span className="text-xs muted">{c.room}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm muted">No classes on this day.</p>
        )}
      </div>
    </section>
  );
}
