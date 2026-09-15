import Link from "next/link";
import { prettyDate } from "@/lib/dates";
import type { PlannedQuiz } from "@/lib/plan/prepare";
import { subjectEmoji } from "@/lib/plan";

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function wd(date: string) {
  return new Date(date + "T00:00:00Z").getUTCDay();
}

/** The kid's view of the weekly plan: a strip of days plus today's quizzes and anything left from earlier days. */
export function WeekPlanCard({ quizzes, today }: { quizzes: PlannedQuiz[]; today: string }) {
  if (quizzes.length === 0) return null;
  const isDone = (q: PlannedQuiz) => q.attempts.some((a) => a.submitted_at);
  const dates = [...new Set(quizzes.map((q) => q.scheduled_for))].sort();
  const todays = quizzes.filter((q) => q.scheduled_for === today);
  const catchUp = quizzes.filter((q) => q.scheduled_for < today && !isDone(q)).slice(-2);
  const nextDate = dates.find((d) => d > today);
  const bonus = 5;

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="h2">📅 This week&apos;s quizzes</h2>
        <span className="text-xs muted">+{bonus} extra on the day</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto">
        {dates.map((d) => {
          const mine = quizzes.filter((q) => q.scheduled_for === d);
          const done = mine.filter(isDone).length;
          const state = done === mine.length ? "done" : d === today ? "today" : d < today ? "missed" : "locked";
          const cls =
            state === "done" ? "border-good/60 bg-good/15" : state === "today" ? "border-accent bg-accent/15 text-accent-2" : state === "missed" ? "border-warn/60" : "border-line opacity-60";
          return (
            <div key={d} className={`flex flex-col items-center rounded-xl border px-2 py-1.5 min-w-[3.2rem] text-xs ${cls}`}>
              <span className="font-semibold">{d === today ? "Today" : SHORT[wd(d)]}</span>
              <span className="text-xl leading-tight">{state === "done" ? "✅" : state === "today" ? "▶️" : state === "missed" ? "⏰" : "🔒"}</span>
              <span className="muted">{done}/{mine.length}</span>
            </div>
          );
        })}
      </div>
      {todays.length > 0 && (
        <ul className="space-y-2">
          {todays.map((q) => {
            const a = q.attempts.find((x) => x.submitted_at);
            return (
              <li key={q.id} className="flex items-center gap-2 text-sm">
                <span className="text-3xl sticker-still">{q.plan_slot === "exam" ? "🎓" : q.subject ? subjectEmoji(q.subject) : q.plan_slot === "arabic" ? "📗" : "📘"}</span>
                <span className="flex-1 truncate">{q.title}</span>
                {a ? <span className="badge text-good">✓ {a.score}/{a.total}</span> : <Link href={`/quiz/${q.id}`} className="btn-primary btn-sm">Start</Link>}
              </li>
            );
          })}
        </ul>
      )}
      {todays.length === 0 && nextDate && <p className="text-sm muted">Nothing planned today. Next quiz {prettyDate(nextDate)}.</p>}
      {catchUp.length > 0 && (
        <div className="rounded-xl border border-warn/40 p-2 space-y-1">
          <div className="text-xs font-semibold text-warn">Catch up (no day bonus, but still points)</div>
          {catchUp.map((q) => (
            <div key={q.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{prettyDate(q.scheduled_for)} · {q.title}</span>
              <Link href={`/quiz/${q.id}`} className="btn-ghost btn-sm">Do it</Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
