/**
 * Yesterday and today for one child, gathered in one pass.
 *
 * Every figure here is a count of rows that exist. Where a row is absent the briefing says the app was not
 * told, which is a different claim from "the child did nothing" and the only honest one available.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { shiftDate } from "@/lib/dates";
import { build, type Briefing, type Item, type Kind, type QuizRow, type Yesterday } from "./briefing";

export interface DayReport extends Briefing {
  firstName: string;
  fullName: string;
  studentId: string;
  today: string;
  yesterdayDate: string;
}

export async function dayFor(studentId: string, familyId: string, today: string): Promise<DayReport | null> {
  const admin = createAdminClient();
  const yday = shiftDate(today, -1);

  const { data: p } = await admin
    .from("profiles").select("id, full_name").eq("id", studentId).eq("family_id", familyId).maybeSingle();
  const profile = p as { id: string; full_name: string } | null;
  if (!profile) return null;

  const [
    { data: assignments }, { data: quizzes }, { data: checkins },
    { data: logs }, { data: prayers }, { data: snaps }, { data: doneYday },
  ] = await Promise.all([
    admin.from("assignments")
      .select("id, kind, title, subject_name, due_date, completed_at, signed_at")
      .eq("student_id", studentId).limit(300),
    admin.from("quizzes")
      .select("id, title, scheduled_for, attempts(submitted_at)")
      .eq("student_id", studentId).not("scheduled_for", "is", null)
      .gte("scheduled_for", shiftDate(today, -14)).limit(200),
    admin.from("checkins").select("checkin_date").eq("student_id", studentId).eq("checkin_date", yday),
    admin.from("lesson_logs").select("id").eq("student_id", studentId).eq("log_date", yday),
    admin.from("prayer_logs").select("prayer, status").eq("student_id", studentId).eq("log_date", yday),
    admin.from("snaps").select("id").eq("student_id", studentId).eq("taken_on", yday),
    admin.from("assignments").select("title").eq("student_id", studentId)
      .gte("completed_at", `${yday}T00:00:00Z`).lt("completed_at", `${today}T00:00:00Z`),
  ]);

  type ARow = { id: string; kind: string; title: string; subject_name: string | null; due_date: string | null; completed_at: string | null; signed_at: string | null };
  const items: Item[] = ((assignments ?? []) as ARow[]).map((a) => ({
    id: a.id,
    kind: a.kind as Kind,
    title: a.title,
    subject: a.subject_name,
    dueDate: a.due_date,
    completedAt: a.completed_at,
    signedAt: a.signed_at,
  }));

  type QRow = { id: string; title: string; scheduled_for: string | null; attempts: { submitted_at: string | null }[] };
  const rows: QuizRow[] = ((quizzes ?? []) as QRow[]).map((q) => ({
    id: q.id,
    title: q.title,
    scheduledFor: q.scheduled_for,
    submittedAt: q.attempts.find((a) => a.submitted_at)?.submitted_at ?? null,
  }));

  // Yesterday's quizzes read from the attempt, not the schedule: a quiz sat a day late was still sat.
  const { data: sat } = await admin
    .from("attempts")
    .select("score, total, submitted_at, quizzes!inner(title, student_id)")
    .eq("quizzes.student_id", studentId)
    .gte("submitted_at", `${yday}T00:00:00Z`)
    .lt("submitted_at", `${today}T00:00:00Z`);

  const y: Yesterday = {
    checkedIn: (checkins ?? []).length > 0,
    classNotes: (logs ?? []).length,
    quizzesSat: ((sat ?? []) as unknown as { score: number | null; total: number | null; quizzes: { title: string } | null }[])
      .map((a) => ({ title: a.quizzes?.title ?? "a quiz", score: a.score, total: a.total })),
    // A prayer marked missed is a logged fact, and counting it as prayed would be a lie.
    prayersLogged: ((prayers ?? []) as { status: string }[]).filter((r) => r.status !== "missed").length,
    snaps: (snaps ?? []).length,
    finished: ((doneYday ?? []) as { title: string }[]).map((a) => a.title),
  };

  return {
    ...build(items, rows, y, today),
    firstName: profile.full_name.split(" ")[0],
    fullName: profile.full_name,
    studentId,
    today,
    yesterdayDate: yday,
  };
}
