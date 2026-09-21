"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Notes from the family's clinician or specialist: the coach and the chat follow them. */
export async function setProfessionalGuidanceAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const studentId = String(formData.get("student_id") ?? "");
  const text = String(formData.get("guidance") ?? "").trim().slice(0, 3000) || null;
  const supabase = await createClient();
  await supabase.from("profiles").update({ professional_guidance: text }).eq("id", studentId).eq("family_id", family.id).eq("role", "student");
}
