"use server";

import { revalidatePath } from "next/cache";
import { failed } from "@/lib/ops/fault";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateClinicianReport, type ClinicianScope } from "@/lib/coach/clinician";

export async function generateClinicianReportAction(_prev: { error?: string; id?: string } | undefined, formData: FormData): Promise<{ error?: string; id?: string }> {
  const { family } = await requireParent();
  const studentId = String(formData.get("student_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 2000);
  const scope: ClinicianScope = formData.get("scope") === "with_chat_themes" ? "with_chat_themes" : "standard";
  const consent = formData.get("consent") === "on";
  const childInformed = formData.get("child_informed") === "on";
  if (!consent) return { error: "Please confirm you are sharing this with a licensed professional for your child's care." };
  if (scope === "with_chat_themes" && !childInformed) return { error: "To include chat themes, confirm you have told him and he agrees. His privacy promise depends on it." };
  const supabase = await createClient();
  const { data: child } = await supabase.from("profiles").select("id").eq("id", studentId).eq("family_id", family.id).eq("role", "student").maybeSingle();
  if (!child) return { error: "That student is not in your family." };
  try {
    const id = await generateClinicianReport(studentId, family.id, reason, scope);
    revalidatePath(`/parent/clinician/${studentId}`);
    revalidatePath("/coach");
    return { id };
  } catch (err) {
    return failed("actions.clinician.generateClinicianReport", err, "Could not generate the summary.");
  }
}
