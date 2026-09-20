"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { failed } from "@/lib/ops/fault";
import { levelsOf, streamsIn } from "@/lib/curriculum";

const PATHS = ["/parent", "/parent/children", "/learn", "/today", "/calendar"];

/**
 * Attach a child to a curriculum, a grade and — where the grade is streamed — a stream.
 *
 * The stream is checked against the curriculum rather than accepted: a child put in Secondary 3 with no stream, or
 * with a stream that year does not offer, would silently study nothing, and an empty Learn page is indistinguishable
 * from a broken one.
 */
export async function setChildCurriculumAction(formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { family } = await requireParent();
  const studentId = String(formData.get("student_id") ?? "");
  const curriculumId = String(formData.get("curriculum_id") ?? "") || null;
  const gradeRaw = String(formData.get("grade") ?? "");
  const grade = gradeRaw ? Number(gradeRaw) : null;
  const streamRaw = String(formData.get("stream") ?? "");
  const stream = streamRaw || null;

  const admin = createAdminClient();
  const { data: child } = await admin
    .from("profiles").select("id").eq("id", studentId).eq("family_id", family.id).eq("role", "student").maybeSingle();
  if (!child) return { error: "That is not one of your children." };

  if (curriculumId) {
    if (grade === null || !Number.isFinite(grade)) return { error: "Choose the year as well." };
    const levels = await levelsOf(curriculumId);
    if (levels.length === 0) return { error: "That curriculum is not loaded." };
    const streamed = streamsIn(levels, grade);
    if (streamed.length > 0 && !stream) return { error: "That year is split into streams — choose one." };
    const match = levels.find((l) => l.grade === grade && (l.stream ?? null) === stream);
    if (!match) return { error: "That year and stream do not go together." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ curriculum_id: curriculumId, grade, stream: curriculumId ? stream : null })
    .eq("id", studentId)
    .eq("family_id", family.id);
  if (error) return failed("actions.curriculum.setChild", error);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: curriculumId ? "Saved. His subjects now come from the curriculum." : "Curriculum cleared." };
}
