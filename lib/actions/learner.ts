"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEARNER_QUESTIONS, type LearnerAnswers } from "@/lib/learner";

const FIRST_TIME_POINTS = 15;

export async function saveLearnerProfileAction(answers: LearnerAnswers): Promise<{ error?: string; earned?: number }> {
  const { profile } = await requireStudent();
  const clean: LearnerAnswers = {};
  for (const q of LEARNER_QUESTIONS) {
    const v = answers[q.id];
    if (v && q.options.some((o) => o.value === v)) clean[q.id] = v;
  }
  if (Object.keys(clean).length < 5) return { error: "Answer at least five questions." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ learner_profile: { answers: clean, completed_at: new Date().toISOString() } }).eq("id", profile.id);
  if (error) return { error: error.message };
  // A small thank-you the first time only (unique ref keeps it single).
  const admin = createAdminClient();
  const { error: payErr } = await admin.from("points_ledger").insert({ student_id: profile.id, delta: FIRST_TIME_POINTS, reason: "Told the coach how you learn", ref_type: "learner", ref_id: profile.id });
  ["/me", "/today", "/me/about-me"].forEach((p) => revalidatePath(p));
  return { earned: payErr ? 0 : FIRST_TIME_POINTS };
}
