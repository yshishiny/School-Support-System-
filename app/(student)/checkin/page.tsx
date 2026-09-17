import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, weekdayOf, prettyDate } from "@/lib/dates";
import { CheckinForm } from "@/components/CheckinForm";
import { sameSubject } from "@/lib/integrity";
import { AddAssignmentForm } from "@/components/AddAssignmentForm";
import { buildLessonDays } from "@/lib/lessons";
import { subjectEmoji } from "@/lib/plan";
import type { Assignment, Checkin, CheckinItem, ItemStatus, Subject, TimetableEntry } from "@/lib/types";

export const maxDuration = 60;

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const realToday = todayIn(family.timezone);
  const { date: requested } = await searchParams;
  // A missed day earlier this week can be filled in later: the whole form then refers to that day.
  const today = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested < realToday && requested >= shiftDate(realToday, -6) ? requested : realToday;
  const filledLater = today !== realToday;
  const [{ data: open }, { data: checkins }, { data: weekCheckins }, { data: subjects }, { data: timetable }, { data: logs }, { data: topics }, { data: offRows }] = await Promise.all([
    supabase.from("assignments").select("*").eq("student_id", profile.id).eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("checkins").select("*, checkin_items(*)").eq("student_id", profile.id).eq("checkin_date", today).maybeSingle(),
    supabase.from("checkins").select("checkin_date").eq("student_id", profile.id).gte("checkin_date", shiftDate(realToday, -6)).lte("checkin_date", realToday),
    supabase.from("subjects").select("*").eq("student_id", profile.id).order("name"),
    supabase.from("timetable_entries").select("*").eq("student_id", profile.id).order("weekday").order("start_time"),
    supabase.from("lesson_logs").select("log_date, subject_name, note, topic_id, homework_given, homework, homework_due").eq("student_id", profile.id).gte("log_date", shiftDate(today, -30)).order("log_date"),
    supabase.from("topics").select("id, subject, name, unit, sort").eq("track", "school").eq("grade", profile.grade ?? 0).order("subject").order("sort"),
    supabase.from("school_days_off").select("day").eq("family_id", family.id).gte("day", shiftDate(today, -10)).lte("day", shiftDate(today, 14)),
  ]);
  const week = (timetable ?? []) as TimetableEntry[];
  const todayRows = week.filter((t) => t.weekday === weekdayOf(today));
  const doneDates = new Set((weekCheckins ?? []).map((c) => c.checkin_date as string));
  const missedDays = Array.from({ length: 6 }, (_, k) => shiftDate(realToday, -6 + k)).filter((d) => !doneDates.has(d));
  const lessonDays = buildLessonDays({ today, lookBackDays: filledLater ? 0 : undefined, timetable: week, topics: topics ?? [], logs: (logs ?? []) as { log_date: string; subject_name: string; note: string; topic_id: string | null; homework_given: boolean | null; homework: string | null; homework_due: string | null }[], daysOff: (offRows ?? []).map((d) => d.day as string) });
  const { data: sharedRows } = await supabase.from("materials").select("subject, title, topics").eq("student_id", profile.id).eq("status", "ready").gte("created_at", `${shiftDate(today, -6)}T00:00:00Z`);
  const shared = ((sharedRows ?? []) as { subject: string | null; title: string; topics: string[] | null }[]).filter((m) => m.subject);
  for (const day of lessonDays) for (const sub of day.subjects) {
    const mine = shared.filter((m) => sameSubject(m.subject!, sub.subject)).map((m) => ({ title: m.title, topics: (m.topics ?? []).slice(0, 5) }));
    if (mine.length) sub.schoolShared = mine;
  }
  const todays = (checkins ?? null) as (Checkin & { checkin_items: CheckinItem[] }) | null;
  const existingItems: Record<string, ItemStatus> = {};
  todays?.checkin_items.forEach((i) => (existingItems[i.assignment_id] = i.status));
  const assignments = (open ?? []) as Assignment[];
  const dueNow = assignments.filter((a) => a.due_date !== null && a.due_date <= today);

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/today" className="text-sm muted">← Today</Link>
        <span className="badge">{prettyDate(today)}{filledLater ? " · filled in later" : ""}</span>
      </div>
      {missedDays.length > 0 && (
        <div className="card !py-2 text-xs space-y-1">
          <div className="font-semibold">Missed a day? Fill it in before the week closes · +5 instead of +10, streak kept</div>
          <div className="flex flex-wrap gap-1.5">
            <Link href="/checkin" className={`chip ${!filledLater ? "chip-on" : ""}`}>Today</Link>
            {missedDays.map((d) => <Link key={d} href={`/checkin?date=${d}`} className={`chip ${today === d ? "chip-on" : ""}`}>{prettyDate(d)}</Link>)}
          </div>
        </div>
      )}
      {todayRows.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {todayRows.map((t) => (
            <span key={t.id} className="badge shrink-0">{subjectEmoji(t.subject_name)} {t.start_time.slice(0, 5)} {t.subject_name}</span>
          ))}
        </div>
      )}
      <CheckinForm items={dueNow} today={today} existing={todays} existingItems={existingItems} lessonDays={lessonDays} filledLater={filledLater} />
      <details className="card">
        <summary className="cursor-pointer font-semibold">➕ Teacher gave new homework? Add it</summary>
        <div className="mt-3">
          <AddAssignmentForm subjects={(subjects ?? []) as Subject[]} defaultDate={shiftDate(today, 1)} compact />
        </div>
      </details>
    </main>
  );
}
