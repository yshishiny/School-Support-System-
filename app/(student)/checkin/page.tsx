import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, weekdayOf, prettyDate } from "@/lib/dates";
import { CheckinForm } from "@/components/CheckinForm";
import { AddAssignmentForm } from "@/components/AddAssignmentForm";
import { buildLessonDays } from "@/lib/lessons";
import { subjectEmoji } from "@/lib/plan";
import type { Assignment, Checkin, CheckinItem, ItemStatus, Subject, TimetableEntry } from "@/lib/types";

export const maxDuration = 60;

export default async function CheckinPage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const [{ data: open }, { data: checkins }, { data: subjects }, { data: timetable }, { data: logs }, { data: topics }] = await Promise.all([
    supabase.from("assignments").select("*").eq("student_id", profile.id).eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("checkins").select("*, checkin_items(*)").eq("student_id", profile.id).eq("checkin_date", today).maybeSingle(),
    supabase.from("subjects").select("*").eq("student_id", profile.id).order("name"),
    supabase.from("timetable_entries").select("*").eq("student_id", profile.id).order("weekday").order("start_time"),
    supabase.from("lesson_logs").select("log_date, subject_name, note, topic_id").eq("student_id", profile.id).gte("log_date", shiftDate(today, -30)).order("log_date"),
    supabase.from("topics").select("id, subject, name, unit, sort").eq("track", "school").eq("grade", profile.grade ?? 0).order("subject").order("sort"),
  ]);
  const week = (timetable ?? []) as TimetableEntry[];
  const todayRows = week.filter((t) => t.weekday === weekdayOf(today));
  const lessonDays = buildLessonDays({ today, timetable: week, topics: topics ?? [], logs: (logs ?? []) as { log_date: string; subject_name: string; note: string; topic_id: string | null }[] });
  const todays = (checkins ?? null) as (Checkin & { checkin_items: CheckinItem[] }) | null;
  const existingItems: Record<string, ItemStatus> = {};
  todays?.checkin_items.forEach((i) => (existingItems[i.assignment_id] = i.status));
  const assignments = (open ?? []) as Assignment[];
  const dueNow = assignments.filter((a) => a.due_date !== null && a.due_date <= today);

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/today" className="text-sm muted">← Today</Link>
        <span className="badge">{prettyDate(today)}</span>
      </div>
      {todayRows.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {todayRows.map((t) => (
            <span key={t.id} className="badge shrink-0">{subjectEmoji(t.subject_name)} {t.start_time.slice(0, 5)} {t.subject_name}</span>
          ))}
        </div>
      )}
      <CheckinForm items={dueNow} today={today} existing={todays} existingItems={existingItems} lessonDays={lessonDays} />
      <details className="card">
        <summary className="cursor-pointer font-semibold">➕ Teacher gave new homework? Add it</summary>
        <div className="mt-3">
          <AddAssignmentForm subjects={(subjects ?? []) as Subject[]} defaultDate={shiftDate(today, 1)} compact />
        </div>
      </details>
    </main>
  );
}
