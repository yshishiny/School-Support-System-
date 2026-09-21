"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { failed } from "@/lib/ops/fault";

const PATHS = ["/parent", "/learn"];

/**
 * "This matched what the class did."
 *
 * The one judgement the four dimensions hand to a person rather than a model. Until it is given, a child reading
 * the lesson is told a model wrote it and to speak up if it looks different from his teacher; afterwards he is
 * told a parent checked it too. Nothing else in the app changes — the lesson was already released.
 */
export async function confirmLessonAction(formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { profile, family } = await requireParent();
  const lessonId = String(formData.get("lesson_id") ?? "");
  if (!lessonId) return { error: "Nothing to confirm." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;

  const admin = createAdminClient();
  // The cache is shared, so a parent may only speak for a year one of their own children is actually in.
  const { data: kids } = await admin.from("profiles").select("grade").eq("family_id", family.id).eq("role", "student");
  const grades = [...new Set(((kids ?? []) as { grade: number | null }[]).map((k) => k.grade).filter((g): g is number => g !== null))];
  const { data: lesson } = await admin.from("lessons").select("id, grade").eq("id", lessonId).maybeSingle();
  if (!lesson || (lesson.grade !== null && !grades.includes(lesson.grade))) {
    return { error: "That lesson is not in one of your children's years." };
  }

  const { error } = await admin
    .from("lessons")
    .update({ human_reviewed_by: profile.id, human_reviewed_at: new Date().toISOString(), human_note: note })
    .eq("id", lessonId);
  if (error) return failed("actions.teaching.confirmLesson", error);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: "Marked as matching the class." };
}

/**
 * "This is not what the class did."
 *
 * The lesson is deleted rather than flagged. The cache is the only reason it would ever be served again, so
 * removing it is what actually stops a child reading it; the next child to open the topic gets a freshly written
 * one, which goes through the same checks. The reason is kept on the topic so the writer is not simply told to
 * try again with no idea what was wrong.
 */
export async function rejectLessonAction(formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { profile, family } = await requireParent();
  const lessonId = String(formData.get("lesson_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 400);
  if (!lessonId) return { error: "Nothing to send back." };
  if (reason.length < 5) return { error: "Say in a few words what was wrong, so the next one is better." };

  const admin = createAdminClient();
  const { data: kids } = await admin.from("profiles").select("grade").eq("family_id", family.id).eq("role", "student");
  const grades = [...new Set(((kids ?? []) as { grade: number | null }[]).map((k) => k.grade).filter((g): g is number => g !== null))];
  const { data: lesson } = await admin.from("lessons").select("id, grade, topic_id, level").eq("id", lessonId).maybeSingle();
  if (!lesson || (lesson.grade !== null && !grades.includes(lesson.grade))) {
    return { error: "That lesson is not in one of your children's years." };
  }

  await admin.from("lesson_rejections").insert({
    topic_id: lesson.topic_id, level: lesson.level, grade: lesson.grade,
    reason, family_id: family.id, created_by: profile.id,
  });
  const { error } = await admin.from("lessons").delete().eq("id", lessonId);
  if (error) return failed("actions.teaching.rejectLesson", error);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: "Sent back. A new lesson is written the next time it is opened." };
}
