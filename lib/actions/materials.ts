"use server";

import { logError } from "@/lib/ops/log";

import { ACCEPT_LABEL, FILE_KINDS } from "@/lib/materials/files";
import { extractText } from "@/lib/materials/extract-text";
import { decideWeek, schoolWeekStart } from "@/lib/materials/week";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireParent, requireSession, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shiftDate, todayIn } from "@/lib/dates";
import { readMaterial, type MaterialInput } from "@/lib/ai/read-material";
import { generateQuiz } from "@/lib/ai/generate-quiz";
import { transcribeWorksheet } from "@/lib/ai/transcribe-worksheet";
import { learnerPromptLine } from "@/lib/learner";
import { themeById } from "@/lib/themes";
import { MATERIAL_BUCKET, type MaterialRow } from "@/lib/materials/server";
import type { ExtractedItem } from "@/lib/ai/extract-items";

const PATHS = ["/parent", "/parent/materials", "/parent/assignments", "/learn", "/today", "/calendar"];
const MIMES = new Set(FILE_KINDS.map((k) => k.mime));

export interface RegisterMaterialResult { error?: string; id?: string; title?: string; summary?: string; items?: number }

/**
 * After the browser uploaded the file to Storage: record it, then read it with the AI.
 * Parents may add for any child; a child only for himself. Reading failures keep the file (status "failed").
 */
export async function registerMaterialAction(studentId: string, path: string, meta: { mime: string; size: number; name: string; subject: string; instructions: string; weekSummary?: "this" | "last" | null }): Promise<RegisterMaterialResult> {
  const { profile, family } = await requireSession();
  if (!path.startsWith(`${family.id}/${studentId}/`)) return { error: "Bad upload path." };
  if (profile.role !== "parent" && profile.id !== studentId) return { error: "Not allowed." };
  if (!MIMES.has(meta.mime)) return { error: `Only ${ACCEPT_LABEL} files.` };
  const admin = createAdminClient();
  const { data: student } = await admin.from("profiles").select("full_name, grade").eq("id", studentId).eq("family_id", family.id).maybeSingle();
  if (!student) return { error: "Child not found." };
  const subject = meta.subject.trim().slice(0, 60) || null;
  const instructions = meta.instructions.trim().slice(0, 600) || null;
  const fallbackTitle = meta.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 80) || "School file";
  const { data: row, error } = await admin
    .from("materials")
    .insert({ family_id: family.id, student_id: studentId, uploaded_by: profile.id, subject, title: fallbackTitle, instructions, path, mime: meta.mime, size_bytes: meta.size, is_week_summary: !!meta.weekSummary, covers_week_start: meta.weekSummary ? (meta.weekSummary === "this" ? schoolWeekStart(todayIn(family.timezone)) : shiftDate(schoolWeekStart(todayIn(family.timezone)), -7)) : null })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Could not save." };

  const r = await readAndStore(row.id, { path, mime: meta.mime, subject, instructions, fallbackTitle, grade: student.grade, firstName: student.full_name.split(" ")[0], today: todayIn(family.timezone), weekChoice: meta.weekSummary ?? null });
  PATHS.forEach((p) => revalidatePath(p));
  return r;
}

function friendlyAiError(msg: string): string {
  if (/credit balance is too low/i.test(msg)) return "The AI account is out of credit. Top up at console.anthropic.com (Plans & Billing), then tap “Read again”.";
  if (/rate limit|overloaded|529/i.test(msg)) return "The AI is busy right now. Tap “Read again” in a minute.";
  if (/100 pages|too many pages|page limit/i.test(msg)) return "This PDF has more than 100 pages. Split it by chapter and upload the parts.";
  return msg.length > 300 ? msg.slice(0, 300) + "…" : msg;
}

/** Runs the AI reading on a stored file and saves the result (or a friendly error). */
/** PDFs and images go to the model as they are; Office, CSV and text files as extracted text. */
function toInput(buf: Buffer, mime: string, name: string): MaterialInput {
  const text = extractText(buf, mime);
  if (text !== null) return { media_type: "text/plain", text, name };
  return { media_type: mime as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", data: buf.toString("base64") };
}

async function readAndStore(id: string, o: { path: string; mime: string; subject: string | null; instructions: string | null; fallbackTitle: string; grade: number | null; firstName: string; today: string; weekChoice?: "this" | "last" | null }): Promise<RegisterMaterialResult> {
  const admin = createAdminClient();
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
    const { data: file } = await admin.storage.from(MATERIAL_BUCKET).download(o.path);
    if (!file) throw new Error("Could not read the uploaded file back.");
    const buf = Buffer.from(await file.arrayBuffer());
    const reading0 = await readMaterial(toInput(buf, o.mime, o.fallbackTitle), { today: o.today, subject: o.subject, instructions: o.instructions, grade: o.grade, studentFirstName: o.firstName });
    const reading = reading0;
    // Week summaries: which week the syllabus covers, and a note when the dates in the file look wrong.
    const isWeek = !!o.weekChoice || reading.is_week_summary;
    const decision = isWeek ? decideWeek(o.today, o.weekChoice ?? null, reading.covers_from, reading.covers_to) : null;
    const weekFields = isWeek ? { is_week_summary: true, covers_week_start: decision!.coversWeekStart, covers_from: reading.covers_from, covers_to: reading.covers_to, date_note: decision!.note, subjects: reading.subjects } : { subjects: reading.subjects };
    await admin
      .from("materials")
      .update({ status: "ready", title: reading.title.slice(0, 120) || o.fallbackTitle, subject: o.subject ?? reading.subject, kind: reading.kind, summary: reading.summary, language: reading.language, topics: reading.topics, digest: reading.digest.slice(0, 20000), items: reading.items, items_reviewed_at: null, error: null, ...weekFields })
      .eq("id", id);
    return { id, title: reading.title, summary: reading.summary, items: reading.items.length };
  } catch (err) {
    const msg = friendlyAiError(err instanceof Error ? err.message : String(err));
    await logError("materials.read", err, { meta: { materialId: id, mime: o.mime, title: o.fallbackTitle } });
    await admin.from("materials").update({ status: "failed", error: msg }).eq("id", id);
    return { id, title: o.fallbackTitle, summary: `Saved, but the AI could not read it. ${msg}`, items: 0 };
  }
}

/** Nightly: re-read files that failed for a temporary reason (credit, busy). Service role, no session. */
export async function retryFailedMaterials(limit = 6): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("materials")
    .select("*, profiles!materials_student_id_fkey(full_name, grade), families!materials_family_id_fkey(timezone)")
    .eq("status", "failed")
    .or("error.ilike.%credit%,error.ilike.%busy%,error.ilike.%rate limit%,error.ilike.%overloaded%")
    .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString())
    .order("created_at")
    .limit(limit);
  const out: string[] = [];
  for (const m of (data ?? []) as (MaterialRow & { profiles: { full_name: string; grade: number | null } | null; families: { timezone: string } | null })[]) {
    const r = await readAndStore(m.id, { path: m.path, mime: m.mime, subject: m.subject, instructions: m.instructions, fallbackTitle: m.title, grade: m.profiles?.grade ?? null, firstName: m.profiles?.full_name.split(" ")[0] ?? "the student", today: todayIn(m.families?.timezone ?? "Africa/Cairo") });
    out.push(`${m.title}: ${r.summary?.startsWith("Saved, but") ? "still failing" : "read"}`);
  }
  return out;
}

/** Re-runs the reading on a file that failed (out of credit, busy) or whose instructions changed. */
export async function rereadMaterialAction(materialId: string): Promise<RegisterMaterialResult> {
  const { profile, family } = await requireSession();
  const admin = createAdminClient();
  const { data } = await admin.from("materials").select("*, profiles!materials_student_id_fkey(full_name, grade)").eq("id", materialId).eq("family_id", family.id).maybeSingle();
  const m = data as (MaterialRow & { profiles: { full_name: string; grade: number | null } | null }) | null;
  if (!m) return { error: "File not found." };
  if (profile.role !== "parent" && profile.id !== m.student_id) return { error: "Not allowed." };
  const r = await readAndStore(m.id, { path: m.path, mime: m.mime, subject: m.subject, instructions: m.instructions, fallbackTitle: m.title, grade: m.profiles?.grade ?? null, firstName: m.profiles?.full_name.split(" ")[0] ?? "the student", today: todayIn(family.timezone), weekChoice: m.covers_week_start ? (m.covers_week_start === schoolWeekStart(todayIn(family.timezone)) ? "this" : "last") : null });
  PATHS.forEach((p) => revalidatePath(p));
  return r;
}

/** Parent (or the child) turns the suggested tasks into assignments. Skips duplicates by title and date. */
export async function acceptMaterialItemsAction(materialId: string, keep: number[], edits: Record<number, { due_date?: string | null; title?: string }> = {}): Promise<{ added: number }> {
  const { profile, family } = await requireSession();
  const admin = createAdminClient();
  const { data } = await admin.from("materials").select("*").eq("id", materialId).eq("family_id", family.id).maybeSingle();
  const m = data as MaterialRow | null;
  if (!m) return { added: 0 };
  if (profile.role !== "parent" && profile.id !== m.student_id) return { added: 0 };
  const items = (m.items ?? [])
    .map((it, i) => {
      const e = edits[i];
      if (!e) return it;
      const due = e.due_date === undefined ? it.due_date : e.due_date && /^\d{4}-\d{2}-\d{2}$/.test(e.due_date) ? e.due_date : null;
      return { ...it, due_date: due, title: e.title?.trim().slice(0, 120) || it.title };
    })
    .filter((_, i) => keep.includes(i));
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

export interface PrepareWorksheetResult { error?: string; questions?: number; skipped?: number; note?: string }

/** Parent or child: transcribe the sheet's own questions into a stored practice set (once per file). */
export async function prepareWorksheetAction(materialId: string): Promise<PrepareWorksheetResult> {
  const { profile, family } = await requireSession();
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not configured on the server." };
  const admin = createAdminClient();
  const { data } = await admin.from("materials").select("*, profiles!materials_student_id_fkey(grade)").eq("id", materialId).eq("family_id", family.id).maybeSingle();
  const m = data as (MaterialRow & { profiles: { grade: number | null } | null }) | null;
  if (!m) return { error: "File not found." };
  if (profile.role !== "parent" && profile.id !== m.student_id) return { error: "Not allowed." };
  try {
    const { data: file } = await admin.storage.from(MATERIAL_BUCKET).download(m.path);
    if (!file) throw new Error("Could not read the file back.");
    const buf = Buffer.from(await file.arrayBuffer());
    const t = await transcribeWorksheet(toInput(buf, m.mime, m.title), { title: m.title, subject: m.subject, grade: m.profiles?.grade ?? null });
    if (t.questions.length === 0) return { error: `No question could be transcribed. ${t.note}` };
    await admin.from("materials").update({ worksheet: { questions: t.questions, skipped: t.skipped, note: t.note, model: t.model, prepared_at: new Date().toISOString() } }).eq("id", m.id);
    PATHS.forEach((p) => revalidatePath(p));
    return { questions: t.questions.length, skipped: t.skipped, note: t.note };
  } catch (err) {
    return { error: friendlyAiError(err instanceof Error ? err.message : String(err)) };
  }
}

/** The child does the sheet on the system: a quiz built from the stored transcription (can be redone). */
export async function startWorksheetAction(materialId: string): Promise<{ error?: string }> {
  const { profile } = await requireStudent();
  const admin = createAdminClient();
  const { data } = await admin.from("materials").select("*").eq("id", materialId).eq("student_id", profile.id).maybeSingle();
  const m = data as MaterialRow | null;
  if (!m?.worksheet?.questions?.length) return { error: "This sheet is not prepared yet." };
  const qs = m.worksheet.questions;
  const { data: quiz, error } = await admin
    .from("quizzes")
    .insert({ student_id: profile.id, topic_id: null, track: "school", title: `Worksheet: ${m.title}`, passage: null, difficulty: "medium", language: m.language === "arabic" ? "ar" : "en", material_id: materialId })
    .select("id")
    .single();
  if (error || !quiz) return { error: error?.message ?? "Could not start." };
  const { data: rows, error: qErr } = await admin
    .from("quiz_questions")
    .insert(qs.map((q, i) => ({ quiz_id: quiz.id, position: i + 1, prompt: q.prompt, choices: q.choices, skill_tag: q.skill_tag })))
    .select("id, position");
  if (qErr || !rows) {
    await admin.from("quizzes").delete().eq("id", quiz.id);
    return { error: qErr?.message ?? "Could not save the questions." };
  }
  await admin.from("quiz_answer_keys").insert(rows.map((r) => ({ question_id: r.id, correct_index: qs[r.position - 1].correct_index, explanation: qs[r.position - 1].explanation })));
  redirect(`/quiz/${quiz.id}`);
}

/** Parent corrects which week a syllabus covers ("this", "last", or a Sunday date), or says it is not a week summary. */
export async function setMaterialWeekAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const id = String(formData.get("id") ?? "");
  const choice = String(formData.get("week") ?? "");
  const today = todayIn(family.timezone);
  const thisWeek = schoolWeekStart(today);
  const start = choice === "this" ? thisWeek : choice === "last" ? shiftDate(thisWeek, -7) : /^\d{4}-\d{2}-\d{2}$/.test(choice) ? schoolWeekStart(choice) : null;
  const supabase = await createClient();
  await supabase.from("materials").update(start ? { is_week_summary: true, covers_week_start: start, date_note: `Week set by a parent to ${start}.` } : { is_week_summary: false, covers_week_start: null, date_note: null }).eq("id", id).eq("family_id", family.id);
  ["/parent/materials", "/learn", "/checkin", "/parent"].forEach((p) => revalidatePath(p));
}
