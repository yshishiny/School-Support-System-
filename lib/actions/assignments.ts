"use server";

import { revalidatePath } from "next/cache";
import { failed } from "@/lib/ops/fault";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const PATHS = ["/today", "/calendar", "/parent", "/parent/assignments", "/parent/day"];
function revalidateAll() {
  PATHS.forEach((p) => revalidatePath(p));
}

export async function createAssignmentAction(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const { profile } = await requireSession();
  const supabase = await createClient();
  const isParent = profile.role === "parent";
  const studentId = isParent ? String(formData.get("student_id")) : profile.id;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };
  const subjectId = String(formData.get("subject_id") ?? "") || null;
  const { error } = await supabase.from("assignments").insert({
    student_id: studentId,
    subject_id: subjectId,
    subject_name: String(formData.get("subject_name") ?? "").trim() || null,
    kind: String(formData.get("kind") ?? "homework"),
    title,
    details: String(formData.get("details") ?? "").trim() || null,
    due_date: String(formData.get("due_date") ?? "") || null,
    source: isParent ? "manual" : "student",
    created_by: profile.id,
  });
  if (error) return failed("actions.assignments.createAssignment", error);
  revalidateAll();
  return {};
}

export async function setAssignmentStatusAction(formData: FormData) {
  await requireSession();
  const supabase = await createClient();
  const status = String(formData.get("status"));
  await supabase
    .from("assignments")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", String(formData.get("id")));
  revalidateAll();
}

/**
 * A parent signs a paper the school sent home.
 *
 * Only a parent, and the signature records which one: in a house with two, "it was signed" and "I signed it"
 * are different facts, and the second is the one that settles an argument at the door on Monday morning.
 * Signing is kept apart from completing because a child cannot clear this by doing anything.
 */
export async function signPaperAction(formData: FormData): Promise<void> {
  const { profile, family } = await requireSession();
  if (profile.role !== "parent") return;
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const undo = formData.get("undo") === "true";
  if (!id) return;

  // An assignment belongs to a child, not to a family, so the family is reached through the child. Without
  // this the id alone would be the only thing standing between one family's paper and another's.
  const { data: row } = await supabase
    .from("assignments")
    .select("id, profiles!assignments_student_id_fkey(family_id)")
    .eq("id", id)
    .maybeSingle();
  const owner = (row as { profiles: { family_id: string } | null } | null)?.profiles?.family_id;
  if (!owner || owner !== family.id) return;

  await supabase
    .from("assignments")
    .update(undo ? { signed_at: null, signed_by: null } : { signed_at: new Date().toISOString(), signed_by: profile.id })
    .eq("id", id);
  revalidateAll();
}

export async function deleteAssignmentAction(formData: FormData) {
  const { profile } = await requireSession();
  if (profile.role !== "parent") return;
  const supabase = await createClient();
  await supabase.from("assignments").delete().eq("id", String(formData.get("id")));
  revalidateAll();
}
