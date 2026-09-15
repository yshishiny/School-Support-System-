"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateCoachReport } from "@/lib/coach/run";

export async function generateCoachReportAction(studentId: string): Promise<{ error?: string; headline?: string }> {
  const { family } = await requireParent();
  const supabase = await createClient();
  const { data: child } = await supabase.from("profiles").select("id").eq("id", studentId).eq("family_id", family.id).eq("role", "student").maybeSingle();
  if (!child) return { error: "That student is not in your family." };
  try {
    const report = await generateCoachReport(studentId);
    ["/parent/progress", "/parent", "/today", "/parent/plan"].forEach((p) => revalidatePath(p));
    return { headline: report.headline };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The coach could not run." };
  }
}
