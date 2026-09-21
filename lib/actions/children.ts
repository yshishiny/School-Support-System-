"use server";

import { revalidatePath } from "next/cache";
import { failed } from "@/lib/ops/fault";
import { requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { findTelegramChat, sendTelegram } from "@/lib/whatsapp/send";

const CHILD_DOMAIN = process.env.CHILD_LOGIN_DOMAIN ?? "study.local";

export async function createChildAction(_prev: { error?: string; ok?: string } | undefined, formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { family } = await requireParent();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const password = String(formData.get("password") ?? "");
  const stage = (["school", "university", "postgraduate", "adult"].includes(String(formData.get("stage"))) ? String(formData.get("stage")) : "school") as "school" | "university" | "postgraduate" | "adult";
  const grade = stage === "school" ? Number(formData.get("grade") ?? 0) : 0;
  const birthDate = String(formData.get("birth_date") ?? "").trim();
  const emoji = String(formData.get("avatar_emoji") ?? "🎓").trim() || "🎓";
  const subjects = String(formData.get("subjects") ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!fullName || !username || password.length < 6 || (stage === "school" && !(grade >= 1 && grade <= 12))) {
    return { error: "Name, username, a password of 6+ characters and, for school, a grade (1-12) are required." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@${CHILD_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { role: "student", full_name: fullName, family_id: family.id, grade: grade || null, avatar_emoji: emoji },
  });
  if (error || !data.user) return failed("actions.children.addChild", error, "Could not create the account.");
  await admin.from("profiles").update({ stage, birth_date: /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate : null }).eq("id", data.user.id);

  if (subjects.length) {
    await admin.from("subjects").insert(subjects.map((name) => ({ student_id: data.user!.id, name })));
  }
  const copied = grade ? await copyTimetableTemplate(data.user.id, grade) : 0;
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

export async function updateFamilyAction(_prev: { error?: string; ok?: string } | undefined, formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { family } = await requireParent();
  const supabase = await createClient();
  const timezone = String(formData.get("timezone") ?? "Africa/Cairo").trim() || "Africa/Cairo";
  const reportHour = Number(formData.get("report_hour") ?? 20);
  const name = String(formData.get("name") ?? "").trim() || family.name;
  const { error } = await supabase
    .from("families")
    .update({ timezone, report_hour: reportHour, name })
    .eq("id", family.id);
  if (error) return failed("actions.children.updateFamily", error);
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

export async function connectTelegramAction(_prev: { error?: string; ok?: string } | undefined, formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { profile } = await requireParent();
  const supabase = await createClient();
  // Accept a bare id, or a pasted link like https://web.telegram.org/a/#8902952794
  const manual = (String(formData.get("telegram_chat_id") ?? "").match(/-?\d{5,}/) ?? [""])[0];
  let chatId = manual;
  let name = "you";
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { error: "TELEGRAM_BOT_TOKEN is not set in Vercel yet. Add it under Settings → Environment Variables, redeploy, then connect again." };
  }
  if (!chatId) {
    const found = await findTelegramChat();
    if ("error" in found) return { error: found.error };
    chatId = found.chatId;
    name = found.name;
  } else if (process.env.TELEGRAM_BOT_TOKEN.startsWith(chatId + ":")) {
    return { error: "That number is the bot's own ID. Leave the box empty, send the bot a message in Telegram, and tap Connect." };
  }
  const { error } = await supabase.from("profiles").update({ telegram_chat_id: chatId }).eq("id", profile.id);
  if (error) return failed("actions.children.connectTelegram", error);
  const test = await sendTelegram(chatId, `✅ Study Portal connected for ${profile.full_name.split(" ")[0]}. Daily reports and alerts will arrive here.`);
  revalidatePath("/parent/settings");
  return test.ok ? { ok: `Connected to ${name}. A test message was sent.` } : { error: `Saved, but the test message failed: ${test.error}` };
}

export async function disconnectTelegramAction() {
  const { profile } = await requireParent();
  const supabase = await createClient();
  await supabase.from("profiles").update({ telegram_chat_id: null }).eq("id", profile.id);
  revalidatePath("/parent/settings");
}

/** Parent picks a child's Today layout. */
export async function setChildHomeLayoutAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const studentId = String(formData.get("student_id") ?? "");
  const layout = String(formData.get("home_layout") ?? "b");
  if (!["a", "b", "c"].includes(layout)) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ home_layout: layout }).eq("id", studentId).eq("family_id", family.id).eq("role", "student");
  revalidatePath("/parent/children");
  revalidatePath("/today");
}

/** Parent marks a school day off (holiday, exam break); the home page and the report say so. */
export async function setDayOffAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const day = String(formData.get("day") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const supabase = await createClient();
  if (formData.get("remove") === "1") {
    await supabase.from("school_days_off").delete().eq("family_id", family.id).eq("day", day);
  } else {
    const label = String(formData.get("label") ?? "").trim().slice(0, 80) || null;
    await supabase.from("school_days_off").upsert({ family_id: family.id, day, label }, { onConflict: "family_id,day" });
  }
  ["/parent", "/parent/children", "/today"].forEach((p) => revalidatePath(p));
}

/** The child's personal page: name, birthday, stage, school, notes for the coach, and an optional new password. */
export async function updateChildProfileAction(_prev: { error?: string; ok?: string } | undefined, formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { family } = await requireParent();
  const studentId = String(formData.get("student_id") ?? "");
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, family_id, role").eq("id", studentId).maybeSingle();
  if (!target || target.family_id !== family.id || target.role !== "student") return { error: "Child not found." };
  const stage = (["school", "university", "postgraduate", "adult"].includes(String(formData.get("stage"))) ? String(formData.get("stage")) : "school") as "school" | "university" | "postgraduate" | "adult";
  const gradeRaw = Number(formData.get("grade") ?? 0);
  const birth = String(formData.get("birth_date") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");
  const patch = {
    full_name: String(formData.get("full_name") ?? "").trim().slice(0, 80) || undefined,
    stage,
    grade: stage === "school" && gradeRaw >= 1 && gradeRaw <= 12 ? gradeRaw : stage === "school" ? undefined : null,
    birth_date: /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : null,
    gender: ["boy", "girl", "other"].includes(gender) ? gender : null,
    school_name: String(formData.get("school_name") ?? "").trim().slice(0, 120) || null,
    phone: String(formData.get("phone") ?? "").trim().slice(0, 30) || null,
    avatar_emoji: String(formData.get("avatar_emoji") ?? "").trim().slice(0, 8) || undefined,
    parent_notes: String(formData.get("parent_notes") ?? "").trim().slice(0, 1500) || null,
    rater: formData.get("rater") === "on",
  };
  const { error } = await admin.from("profiles").update(patch).eq("id", studentId);
  if (error) return failed("actions.children.updateChildProfile", error);
  const pw = String(formData.get("new_password") ?? "");
  if (pw) {
    if (pw.length < 6) return { error: "Saved, but the new password needs 6+ characters." };
    const { error: pwErr } = await admin.auth.admin.updateUserById(studentId, { password: pw });
    if (pwErr) return failed("actions.children.updateChildProfile.password", pwErr, "Saved, but the password was not changed.");
  }
  ["/parent", "/parent/children", "/today", "/me", "/coach"].forEach((p) => revalidatePath(p));
  return { ok: pw ? "Saved, password changed." : "Saved." };
}
