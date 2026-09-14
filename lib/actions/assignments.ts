"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const PATHS = ["/today", "/calendar", "/parent", "/parent/assignments"];
function revalidateAll() {
  PATHS.forEach((p) => revalidatePath(p));
}

export async function createAssignmentAction(_prev: { error?: string } | undefined, formData: FormData) {
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
  if (error) return { error: error.message };
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

export async function deleteAssignmentAction(formData: FormData) {
  const { profile } = await requireSession();
  if (profile.role !== "parent") return;
  const supabase = await createClient();
  await supabase.from("assignments").delete().eq("id", String(formData.get("id")));
  revalidateAll();
}
