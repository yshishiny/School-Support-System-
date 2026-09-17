"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMPENSATION_POINTS, type CompQuestion } from "@/lib/compensation";

const PATHS = ["/allowance", "/today", "/parent", "/parent/allowance"];

export async function markCompensationReadAction(id: string): Promise<void> {
  const { profile } = await requireStudent();
  const admin = createAdminClient();
  await admin.from("late_compensations").update({ read_at: new Date().toISOString() }).eq("id", id).eq("student_id", profile.id).is("read_at", null);
  PATHS.forEach((p) => revalidatePath(p));
}

/** One answer. Right: the late entry now counts. Wrong: read again and try once more. */
export async function answerCompensationAction(id: string, choice: number): Promise<{ correct: boolean; earned: number }> {
  const { profile } = await requireStudent();
  const admin = createAdminClient();
  const { data: row } = await admin.from("late_compensations").select("id, question, attempts, correct, read_at").eq("id", id).eq("student_id", profile.id).maybeSingle();
  if (!row) return { correct: false, earned: 0 };
  if (row.correct) return { correct: true, earned: 0 };
  const q = row.question as CompQuestion;
  const correct = choice === q.correct;
  await admin.from("late_compensations").update({ attempts: (row.attempts ?? 0) + 1, answered_at: new Date().toISOString(), correct, read_at: row.read_at ?? new Date().toISOString() }).eq("id", id);
  let earned = 0;
  if (correct) {
    const { error } = await admin.from("points_ledger").insert({ student_id: profile.id, delta: COMPENSATION_POINTS, reason: "Late entry balanced: two ayahs read, question right", ref_type: "compensation", ref_id: id });
    if (!error) earned = COMPENSATION_POINTS;
  }
  PATHS.forEach((p) => revalidatePath(p));
  return { correct, earned };
}
