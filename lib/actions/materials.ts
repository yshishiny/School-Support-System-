"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/dates";
import { readMaterial, type MaterialInput } from "@/lib/ai/read-material";
import { generateQuiz } from "@/lib/ai/generate-quiz";
import { learnerPromptLine } from "@/lib/learner";
import { themeById } from "@/lib/themes";
import { MATERIAL_BUCKET, type MaterialRow } from "@/lib/materials/server";
import type { ExtractedItem } from "@/lib/ai/extract-items";

const PATHS = ["/parent", "/parent/materials", "/parent/assignments", "/learn", "/today", "/calendar"];
const MIMES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export interface RegisterMaterialResult { error?: string; id?: string; title?: string; summary?: string; items?: number }

/**
 * After the browser uploaded the file to Storage: record it, then read it with the AI.
 * Parents may add for any child; a child only for himself. Reading failures keep the file (status "failed").
 */
export async function registerMaterialAction(studentId: string, path: string, meta: { mime: string; size: number; name: string; subject: string; instructions: string }): Promise<RegisterMaterialResult> {
  const { profile, family } = await requireSession();
  if (!path.startsWith(`${family.id}/${studentId}/`)) return { error: "Bad upload path." };
  if (profile.role !== "parent" && profile.id !== studentId) return { error: "Not allowed." };
  if (!MIMES.has(meta.mime)) return { error: "Only PDF, JPG, PNG or WEBP files." };
  const admin = createAdminClient();
  const { data: student } = await admin.from("profiles").select("full_name, grade").eq("id", studentId).eq("family_id", family.id).maybeSingle();
  if (!student) return { error: "Child not found." };
  const subject = meta.subject.trim().slice(0, 60) || null;
  const instructions = meta.instructions.trim().slice(0, 600) || null;
  const fallbackTitle = meta.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 80) || "School file";
  const { data: row, error } = await admin
    .from("materials")
    .insert({ family_id: family.id, student_id: studentId, uploaded_by: profile.id, subject, title: fallbackTitle, instructions, path, mime: meta.mime, size_bytes: meta.size })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Could not save." };

  const today = todayIn(family.timezone);
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
    const { data: file } = await admin.storage.from(MATERIAL_BUCKET).download(path);
    if (!file) throw new Error("Could not read the uploaded file back.");
    const buf = Buffer.from(await file.arrayBuffer());
    const reading = await readMaterial({ media_type: meta.mime as MaterialInput["media_type"], data: buf.toString("base64") }, { today, subject, instructions, grade: student.grade, studentFirstName: student.full_name.split(" ")[0] });
    await admin
      .from("materials")
      .update({ status: "ready", title: reading.title.slice(0, 120) || fallbackTitle, subject: subject ?? reading.subject, kind: reading.kind, summary: reading.summary, language: reading.language, topics: reading.topics, digest: reading.digest.slice(0, 20000), items: reading.items, error: null })
      .eq("id", row.id);
    PATHS.forEach((p) => revalidatePath(p));
    return { id: row.id, title: reading.title, summary: reading.summary, items: reading.items.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from("materials").update({ status: "failed", error: msg }).eq("id", row.id);
    PATHS.forEach((p) => revalidatePath(p));
    return { id: row.id, title: fallbackTitle, summary: `Saved, but the AI could not read it: ${msg}`, items: 0 };
  }
}

/** Parent (or the child) turns the suggested tasks into assignments. Skips duplicates by title and date. */
export async function acceptMaterialItemsAction(materialId: string, keep: number[]): Promise<{ added: number }> {
  const { profile, family } = await requireSession();
  const admin = createAdminClient();
  const { data } = await admin.from("materials").select("*").eq("id", materialId).eq("family_id", family.id).maybeSingle();
  const m = data as MaterialRow | null;
  if (!m) return { added: 0 };
  if (profile.role !== "parent" && profile.id !== m.student_id) return { added: 0 };
  const items = (m.items ?? []).filter((_, i) => keep.includes(i));
  const { data: subjects } = await admin.from("subjects").select("id,name").eq("student_id", m.student_id);
  const { data: existing } = await admin.from("assignments").select("title,due_date").eq("student_id", m.student_id);
  const seen = new Set((existing ?? []).map((e) => `${e.title.toLowerCase()}|${e.due_date ?? ""}`));
  const rows = [];
  for (const it of items as ExtractedItem[]) {
    const key = `${it.title.toLowerCase()}|${it.due_date ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const subjectName = it.subject ?? m.subject;
    const subject = (subjects ?? []).find((s) => subjectName && s.name.toLowerCase() === subjectName.toLowerCase());
    rows.push({ student_id: m.student_id, subject_id: subject?.id ?? null, subject_name: subjectName, kind: it.kind, title: it.title, details: it.details ? `${it.details}\n(from file: ${m.title})` : `From file: ${m.title}`, due_date: it.due_date, source: profile.role === "parent" ? "whatsapp" : "student", source_excerpt: it.source_excerpt.slice(0, 1000), created_by: profile.id });
  }
  let added = 0;
  if (rows.length) {
    const { error } = await admin.from("assignments").insert(rows);
    if (!error) added = rows.length;
  }
  await admin.from("materials").update({ items_reviewed_at: new Date().toISOString() }).eq("id", materialId);
  PATHS.forEach((p) => revalidatePath(p));
  return { added };
}

export async function dismissMaterialItemsAction(materialId: string): Promise<void> {
  const { family } = await requireSession();
  const admin = createAdminClient();
  await admin.from("materials").update({ items_reviewed_at: new Date().toISOString() }).eq("id", materialId).eq("family_id", family.id);
  PATHS.forEach((p) => revalidatePath(p));
}

export async function updateMaterialAction(formData: FormData): Promise<void> {
  const { profile, family } = await requireSession();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const patch: Record<string, string | null> = {
    title: String(formData.get("title") ?? "").trim().slice(0, 120) || "School file",
    subject: String(formData.get("subject") ?? "").trim().slice(0, 60) || null,
    instructions: String(formData.get("instructions") ?? "").trim().slice(0, 600) || null,
  };
  await supabase.from("materials").update(patch).eq("id", id).eq("family_id", family.id).eq(profile.role === "parent" ? "family_id" : "student_id", profile.role === "parent" ? family.id : profile.id);
  PATHS.forEach((p) => revalidatePath(p));
}

export async function deleteMaterialAction(id: string): Promise<void> {
  const { profile, family } = await requireSession();
  if (profile.role !== "parent") return;
  const admin = createAdminClient();
  const { data: m } = await admin.from("materials").select("id, path").eq("id", id).eq("family_id", family.id).maybeSingle();
  if (!m) return;
  await admin.storage.from(MATERIAL_BUCKET).remove([m.path]);
  await admin.from("materials").delete().eq("id", id);
  PATHS.forEach((p) => revalidatePath(p));
}

const QUESTIONS_PER_SET = 8;

/** The child practises from a file: an 8-question set written only from the file's content. */
export async function createMaterialQuizAction(materialId: string, difficulty: "easy" | "medium" | "hard" = "medium"): Promise<{ error?: string }> {
  const { profile } = await requireStudent();
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not configured on the server." };
  const admin = createAdminClient();
  const { data } = await admin.from("materials").select("*").eq("id", materialId).eq("student_id", profile.id).maybeSingle();
  const m = data as MaterialRow | null;
  if (!m || m.status !== "ready" || !m.digest) return { error: "This file has not been read yet." };
  const { data: prior } = await admin.from("quizzes").select("id").eq("material_id", materialId);
  const priorIds = (prior ?? []).map((q) => q.id);
  let avoid: string[] = [];
  let weak: string[] = [];
  if (priorIds.length) {
    const { data: qs } = await admin.from("quiz_questions").select("id, prompt, skill_tag").in("quiz_id", priorIds);
    avoid = (qs ?? []).map((q) => q.prompt);
    const { data: wrong } = await admin.from("attempt_answers").select("question_id").in("question_id", (qs ?? []).map((q) => q.id)).eq("correct", false);
    const tagOf = new Map((qs ?? []).map((q) => [q.id, q.skill_tag]));
    weak = [...new Set((wrong ?? []).map((w) => tagOf.get(w.question_id)).filter((x): x is string => !!x))].slice(0, 6);
  }
  const language = m.language === "arabic" ? "ar" : "en";
  let generated;
  try {
    generated = await generateQuiz({
      track: "school",
      grade: profile.grade,
      subject: m.subject ?? "School file",
      unit: null,
      topic: (m.topics ?? []).slice(0, 5).join(", ") || m.title,
      actSection: null,
      difficulty,
      count: QUESTIONS_PER_SET,
      weakSkills: weak,
      avoidPrompts: avoid,
      language,
      sourceText: `${m.title}\n${m.instructions ? `Teacher's instructions: ${m.instructions}\n` : ""}${m.digest}`,
      interests: profile.interests,
      themeName: themeById(profile.theme).name,
      learner: learnerPromptLine(profile.learner_profile),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not generate the quiz." };
  }
  const { data: quiz, error } = await admin
    .from("quizzes")
    .insert({ student_id: profile.id, topic_id: null, track: "school", title: generated.title, passage: generated.passage, difficulty, language, material_id: materialId })
    .select("id")
    .single();
  if (error || !quiz) return { error: error?.message ?? "Could not save the quiz." };
  const { data: questions, error: qErr } = await admin
    .from("quiz_questions")
    .insert(generated.questions.map((q, i) => ({ quiz_id: quiz.id, position: i + 1, prompt: q.prompt, choices: q.choices, skill_tag: q.skill_tag })))
    .select("id, position");
  if (qErr || !questions) {
    await admin.from("quizzes").delete().eq("id", quiz.id);
    return { error: qErr?.message ?? "Could not save the questions." };
  }
  await admin.from("quiz_answer_keys").insert(questions.map((row) => ({ question_id: row.id, correct_index: generated.questions[row.position - 1].correct_index, explanation: generated.questions[row.position - 1].explanation })));
  redirect(`/quiz/${quiz.id}`);
}
