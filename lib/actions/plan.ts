"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { prepareNextPlannedQuiz, type PrepareResult } from "@/lib/plan/prepare";

/** Parent-only: writes the next missing quiz in a child's 7-day plan. Call repeatedly until remaining is 0. */
export async function prepareNextPlannedQuizAction(studentId: string): Promise<PrepareResult> {
  const { family } = await requireParent();
  const supabase = await createClient();
  const { data: child } = await supabase.from("profiles").select("id").eq("id", studentId).eq("family_id", family.id).eq("role", "student").maybeSingle();
  if (!child) return { made: null, remaining: 0, error: "That student is not in your family." };
  const result = await prepareNextPlannedQuiz(studentId);
  revalidatePath("/parent/plan");
  revalidatePath("/today");
  revalidatePath("/learn");
  return result;
}
