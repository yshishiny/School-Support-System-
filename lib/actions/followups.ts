"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { FOLLOWUP_POINTS, validAnswer } from "@/lib/followups";

/** The child answers one follow-up question. A short or padded answer is refused; a real one earns a couple of points. */
export async function answerFollowupAction(id: string, text: string): Promise<{ error?: string; ok?: boolean }> {
  const { profile } = await requireStudent();
  const bad = validAnswer(text);
  if (bad) return { error: bad };
  const admin = createAdminClient();
  const { data: row } = await admin.from("integrity_followups").select("id, answer").eq("id", id).eq("student_id", profile.id).maybeSingle();
  if (!row) return { error: "Question not found." };
  if (row.answer) return { ok: true };
  await admin.from("integrity_followups").update({ answer: text.trim().slice(0, 1500), answered_at: new Date().toISOString() }).eq("id", id);
  await admin.from("points_ledger").insert({ student_id: profile.id, delta: FOLLOWUP_POINTS, reason: "Answered your coach's question", ref_type: "followup", ref_id: id }).then(() => null, () => null);
  ["/today", "/coach/followup", "/parent"].forEach((p) => revalidatePath(p));
  return { ok: true };
}
