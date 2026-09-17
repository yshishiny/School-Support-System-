import { createAdminClient } from "@/lib/supabase/admin";
import { weekFor } from "@/lib/allowance";
import { computeIntegrity } from "@/lib/integrity/run";
import { followupQuestion, roundsToOpen, type FollowupRow } from "@/lib/followups";

/** Runs the integrity checks and opens whatever follow-up rounds are due today. Returns the open (unanswered) questions. */
export async function ensureFollowups(studentId: string, familyId: string, today: string, tz: string, payWeekday: number): Promise<FollowupRow[]> {
  const admin = createAdminClient();
  const signals = await computeIntegrity(studentId, today, tz).catch(() => []);
  const weekKey = weekFor(today, payWeekday).start;
  const { data } = await admin.from("integrity_followups").select("id, signal_key, signal_code, signal_label, round, question, asked_on, answer, answered_at").eq("student_id", studentId).gte("asked_on", weekKey).order("round");
  const existing = (data ?? []) as FollowupRow[];
  const open = roundsToOpen(signals, existing, today, weekKey);
  if (open.length) {
    await admin.from("integrity_followups").upsert(
      open.map((o) => ({ student_id: studentId, family_id: familyId, signal_key: `${o.sig.code}:${weekKey}`, signal_code: o.sig.code, signal_label: o.sig.label, round: o.round, question: followupQuestion(o.sig, o.round, o.prev), asked_on: today })),
      { onConflict: "student_id,signal_key,round", ignoreDuplicates: true },
    );
  }
  const { data: after } = await admin.from("integrity_followups").select("id, signal_key, signal_code, signal_label, round, question, asked_on, answer, answered_at").eq("student_id", studentId).gte("asked_on", weekKey).order("asked_on", { ascending: false }).order("round");
  return (after ?? []) as FollowupRow[];
}

/** Everything asked this week and last, for the parent's card and the report. */
export async function loadFollowups(studentIds: string[], since: string): Promise<(FollowupRow & { student_id: string })[]> {
  if (!studentIds.length) return [];
  const admin = createAdminClient();
  const { data } = await admin.from("integrity_followups").select("id, student_id, signal_key, signal_code, signal_label, round, question, asked_on, answer, answered_at").in("student_id", studentIds).gte("asked_on", since).order("asked_on", { ascending: false }).order("round");
  return (data ?? []) as (FollowupRow & { student_id: string })[];
}
