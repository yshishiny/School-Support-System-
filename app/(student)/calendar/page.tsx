import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn, shiftDate, prettyDate, relativeLabel, weekdayOf } from "@/lib/dates";
import { setAssignmentStatusAction } from "@/lib/actions/assignments";
import { KIND_EMOJI, type Assignment } from "@/lib/types";
import { PlannerDays, type PlannerDay } from "@/components/PlannerDays";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The planner: the next two weeks as days, each carrying what the school day actually holds — the classes from the
 * timetable, the quizzes already planned for that date, and anything due. It used to show only homework somebody
 * had typed in, which is why it looked empty on a week with none.
 */
export default async function CalendarPage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const admin = createAdminClient();
  const today = todayIn(family.timezone);
  const horizon = shiftDate(today, 13);

  const [{ data: aRows }, { data: ttRows }, { data: qRows }, { data: offRows }] = await Promise.all([
    supabase.from("assignments").select("*").eq("student_id", profile.id).gte("created_at", shiftDate(today, -60)).order("due_date", { ascending: true, nullsFirst: false }),
    admin.from("timetable_entries").select("weekday, subject_name, start_time, room").eq("student_id", profile.id).order("start_time"),
    admin.from("quizzes").select("id, title, scheduled_for, attempts(submitted_at)").eq("student_id", profile.id).not("scheduled_for", "is", null).gte("scheduled_for", today).lte("scheduled_for", horizon),
    admin.from("school_days_off").select("day").eq("family_id", family.id).gte("day", today).lte("day", horizon),
  ]);

  const all = (aRows ?? []) as Assignment[];
  const open = all.filter((a) => a.status === "open");
  const timetable = (ttRows ?? []) as { weekday: number; subject_name: string; start_time: string; room: string | null }[];
  const quizzes = (qRows ?? []) as { id: string; title: string; scheduled_for: string; attempts: { submitted_at: string | null }[] }[];
  const daysOff = new Set((offRows ?? []).map((d) => d.day as string));

  const days: PlannerDay[] = [];
  for (let k = 0; k < 14; k += 1) {
    const date = shiftDate(today, k);
    const wd = weekdayOf(date);
    days.push({
      date,
      label: k === 0 ? "Today" : k === 1 ? "Tomorrow" : prettyDate(date),
      short: DAY_SHORT[wd],
      isToday: k === 0,
      classes: daysOff.has(date) ? [] : timetable.filter((t) => t.weekday === wd).map((t) => ({ subject: t.subject_name, start: t.start_time.slice(0, 5), room: t.room })),
      quizzes: quizzes.filter((q) => q.scheduled_for === date).map((q) => ({ id: q.id, title: q.title, done: q.attempts.some((a) => a.submitted_at) })),
      due: open.filter((a) => a.due_date === date).map((a) => ({ id: a.id, title: a.title, kind: a.kind, subject: a.subject_name, emoji: KIND_EMOJI[a.kind] })),
    });
  }

  const overdue = open.filter((a) => a.due_date && a.due_date < today);
  const noDate = open.filter((a) => !a.due_date);
  const later = open.filter((a) => a.due_date && a.due_date > horizon);

  return (
    <main className="space-y-3">
      <header className="flex items-center gap-3">
        <span className="text-3xl">🗓️</span>
        <div className="flex-1 min-w-0">
          <h1 className="h1">Planner</h1>
          <p className="text-xs muted">The next two weeks: your classes, the quizzes already booked and everything due.</p>
        </div>
        <Link href="/today" className="btn-ghost btn-sm">Today</Link>
      </header>

      {overdue.length > 0 && (
        <section className="card !py-3 border-2 border-bad/60">
          <h2 className="h2 mb-1">⏰ Late · {overdue.length}</h2>
          <ul className="divide-y divide-line">
            {overdue.map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="flex-1 min-w-0"><span className="font-semibold">{KIND_EMOJI[a.kind]} {a.title}</span><span className="muted"> · {relativeLabel(a.due_date, today)}</span></span>
                <form action={setAssignmentStatusAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="status" value="done" />
                  <button className="btn-ghost btn-sm min-h-9">Done ✓</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PlannerDays days={days} />

      {(noDate.length > 0 || later.length > 0) && (
        <details className="card !py-3">
          <summary className="cursor-pointer font-bold" style={{ fontFamily: "var(--font-display)" }}>📌 No date yet, and further ahead · {noDate.length + later.length}</summary>
          <ul className="mt-2 divide-y divide-line text-sm">
            {[...noDate, ...later].map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 min-w-0">{KIND_EMOJI[a.kind]} {a.title}{a.due_date ? <span className="muted"> · {prettyDate(a.due_date)}</span> : null}</span>
                {(a.kind === "homework" || a.kind === "project") && (
                  <form action={setAssignmentStatusAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="status" value="done" />
                    <button className="btn-ghost btn-sm min-h-9">Done ✓</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {timetable.length === 0 && (
        <p className="card text-sm muted">No timetable yet, so the days are empty. A parent can add it under Children → timetable.</p>
      )}
    </main>
  );
}
