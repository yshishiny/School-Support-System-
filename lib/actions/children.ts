"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { findTelegramChat, sendTelegram } from "@/lib/whatsapp/send";

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
  const copied = await copyTimetableTemplate(data.user.id, grade);
  revalidatePath("/parent/children");
  return { ok: `${fullName} can now log in with username "${username}".${copied ? ` School timetable for grade ${grade} loaded (${copied} periods).` : ""}` };
}

/** Copies the built-in school timetable for a grade into a student's timetable. Returns rows added. */
async function copyTimetableTemplate(studentId: string, grade: number): Promise<number> {
  const admin = createAdminClient();
  const { data: template } = await admin.from("timetable_templates").select("*").eq("grade", grade).order("weekday").order("sort");
  if (!template || template.length === 0) return 0;
  await admin.from("timetable_entries").delete().eq("student_id", studentId);
  const { error } = await admin.from("timetable_entries").insert(
    template.map((t) => ({ student_id: studentId, weekday: t.weekday, start_time: t.start_time, end_time: t.end_time, subject_name: t.subject_name, room: t.teacher })),
  );
  return error ? 0 : template.length;
}

export async function applyTimetableTemplateAction(formData: FormData) {
  const { family } = await requireParent();
  const supabase = await createClient();
  const studentId = String(formData.get("student_id"));
  const { data: student } = await supabase.from("profiles").select("grade, family_id").eq("id", studentId).single();
  if (!student || student.family_id !== family.id || !student.grade) return;
  await copyTimetableTemplate(studentId, student.grade);
  revalidatePath("/parent/children");
  revalidatePath("/today");
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

export async function connectTelegramAction(_prev: { error?: string; ok?: string } | undefined, formData: FormData) {
  const { family } = await requireParent();
  const supabase = await createClient();
  const manual = String(formData.get("telegram_chat_id") ?? "").trim();
  let chatId = manual;
  let name = "you";
  if (!chatId) {
    const found = await findTelegramChat();
    if ("error" in found) return { error: found.error };
    chatId = found.chatId;
    name = found.name;
  }
  const { error } = await supabase.from("families").update({ telegram_chat_id: chatId }).eq("id", family.id);
  if (error) return { error: error.message };
  const test = await sendTelegram(chatId, "✅ Study Portal connected. Daily reports will arrive here.");
  revalidatePath("/parent/settings");
  return test.ok ? { ok: `Connected to ${name}. A test message was sent.` } : { error: `Saved, but the test message failed: ${test.error}` };
}

export async function disconnectTelegramAction() {
  const { family } = await requireParent();
  const supabase = await createClient();
  await supabase.from("families").update({ telegram_chat_id: null }).eq("id", family.id);
  revalidatePath("/parent/settings");
}
