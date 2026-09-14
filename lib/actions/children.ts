"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const CHILD_DOMAIN = process.env.CHILD_LOGIN_DOMAIN ?? "study.local";

export async function createChildAction(_prev: { error?: string; ok?: string } | undefined, formData: FormData) {
  const { family } = await requireParent();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const password = String(formData.get("password") ?? "");
  const grade = Number(formData.get("grade") ?? 0);
  const emoji = String(formData.get("avatar_emoji") ?? "🎓").trim() || "🎓";
  const subjects = String(formData.get("subjects") ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!fullName || !username || password.length < 6 || !(grade >= 1 && grade <= 12)) {
    return { error: "Name, username, a password of 6+ characters and a grade (1-12) are required." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@${CHILD_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { role: "student", full_name: fullName, family_id: family.id, grade, avatar_emoji: emoji },
  });
  if (error || !data.user) return { error: error?.message ?? "Could not create the account." };

  if (subjects.length) {
    await admin.from("subjects").insert(subjects.map((name) => ({ student_id: data.user!.id, name })));
  }
  revalidatePath("/parent/children");
  return { ok: `${fullName} can now log in with username "${username}".` };
}

export async function updateFamilyAction(_prev: { error?: string; ok?: string } | undefined, formData: FormData) {
  const { family } = await requireParent();
  const supabase = await createClient();
  const whatsapp = String(formData.get("parent_whatsapp") ?? "").replace(/[^\d]/g, "");
  const timezone = String(formData.get("timezone") ?? "Africa/Cairo").trim() || "Africa/Cairo";
  const reportHour = Number(formData.get("report_hour") ?? 20);
  const name = String(formData.get("name") ?? "").trim() || family.name;
  const { error } = await supabase
    .from("families")
    .update({ parent_whatsapp: whatsapp || null, timezone, report_hour: reportHour, name })
    .eq("id", family.id);
  if (error) return { error: error.message };
  revalidatePath("/parent/settings");
  return { ok: "Saved." };
}

export async function addSubjectAction(formData: FormData) {
  await requireParent();
  const supabase = await createClient();
  const studentId = String(formData.get("student_id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await supabase.from("subjects").insert({ student_id: studentId, name, teacher: String(formData.get("teacher") ?? "").trim() || null });
  revalidatePath("/parent/children");
}

export async function deleteSubjectAction(formData: FormData) {
  await requireParent();
  const supabase = await createClient();
  await supabase.from("subjects").delete().eq("id", String(formData.get("id")));
  revalidatePath("/parent/children");
}

export async function addTimetableAction(formData: FormData) {
  await requireParent();
  const supabase = await createClient();
  const start = String(formData.get("start_time") ?? "");
  const subject = String(formData.get("subject_name") ?? "").trim();
  if (!start || !subject) return;
  await supabase.from("timetable_entries").insert({
    student_id: String(formData.get("student_id")),
    weekday: Number(formData.get("weekday")),
    start_time: start,
    end_time: String(formData.get("end_time") ?? "") || null,
    subject_name: subject,
    room: String(formData.get("room") ?? "").trim() || null,
  });
  revalidatePath("/parent/children");
}

export async function deleteTimetableAction(formData: FormData) {
  await requireParent();
  const supabase = await createClient();
  await supabase.from("timetable_entries").delete().eq("id", String(formData.get("id")));
  revalidatePath("/parent/children");
}
