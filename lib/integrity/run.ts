import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { shiftDate } from "@/lib/dates";
import { integritySignals, type IntegritySignal } from "@/lib/integrity";

/** Loads a week of the student's activity and runs the integrity checks. */
export async function computeIntegrity(studentId: string, today: string, tz: string): Promise<IntegritySignal[]> {
  const admin = createAdminClient();
  const weekAgo = shiftDate(today, -6);
  const weekAgoIso = new Date(weekAgo + "T00:00:00Z").toISOString();
  const [{ data: attempts }, { data: prayers }, { data: checkins }, { data: logs }, { data: snaps }, { data: materials }, { data: tt }, { data: mannersRows }, { data: tickRows }] = await Promise.all([
    admin.from("attempts").select("submitted_at, seconds, total, tab_switches, kind, quizzes(title)").eq("student_id", studentId).gte("started_at", weekAgoIso),
    admin.from("prayer_logs").select("log_date, logged_at, status, entered_late, claim, prayer").eq("student_id", studentId).gte("log_date", weekAgo),
    admin.from("checkins").select("checkin_date, submitted_at").eq("student_id", studentId).gte("checkin_date", weekAgo),
    admin.from("lesson_logs").select("log_date, subject_name, note").eq("student_id", studentId).gte("log_date", weekAgo),
    admin.from("snaps").select("taken_on, status, ai_verdict").eq("student_id", studentId).gte("taken_on", weekAgo),
    admin.from("materials").select("subject, title, topics, created_at, uploaded_by, student_id, is_week_summary, covers_week_start, subjects").eq("student_id", studentId).eq("status", "ready").or(`created_at.gte.${weekAgoIso},covers_week_start.gte.${shiftDate(weekAgo, -7)}`),
    admin.from("timetable_entries").select("weekday, subject_name").eq("student_id", studentId),
    admin.from("checkins").select("checkin_date, manners_self").eq("student_id", studentId).gte("checkin_date", weekAgo),
    admin.from("kpi_ticks").select("tick_date, code, value").eq("student_id", studentId).gte("tick_date", weekAgo),
  ]);
  type A = { submitted_at: string | null; seconds: number | null; total: number | null; tab_switches: number; kind: string; quizzes: { title: string } | null };
  return integritySignals({
    today,
    attempts: ((attempts ?? []) as unknown as A[]).map((a) => ({ ...a, title: a.quizzes?.title ?? null })),
    prayers: (prayers ?? []) as { log_date: string; logged_at: string; status: string; entered_late: boolean; claim: string | null; prayer: string }[],
    checkins: ((checkins ?? []) as { checkin_date: string; submitted_at: string | null }[]).map((c) => ({ ...c, hourLocal: c.submitted_at ? Number(formatInTimeZone(new Date(c.submitted_at), tz, "H")) : undefined })),
    lessonLogs: (logs ?? []) as { log_date: string; subject_name: string; note: string }[],
    snaps: (snaps ?? []) as { taken_on: string; status: string; ai_verdict: string | null }[],
    materials: ((materials ?? []) as { subject: string | null; title: string; topics: string[] | null; created_at: string; uploaded_by: string | null; student_id: string; is_week_summary: boolean | null; covers_week_start: string | null; subjects: { subject: string; topics: string[] }[] | null }[]).map((m) => ({ subject: m.subject, title: m.title, topics: m.topics ?? [], created_at: m.created_at, uploaded_by_student: m.uploaded_by === m.student_id, is_week_summary: !!m.is_week_summary, covers_week_start: m.covers_week_start, subjects: m.subjects ?? [] })),
    timetableSubjects: (tt ?? []) as { weekday: number; subject_name: string }[],
    mannersSelf: ((mannersRows ?? []) as { checkin_date: string; manners_self: number | null }[]).map((c) => ({ date: c.checkin_date, self: c.manners_self })),
    parentTicks: (tickRows ?? []) as { tick_date: string; code: string; value: boolean }[],
  });
}
