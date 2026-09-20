"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { defaultLevel } from "@/lib/entitlement";
import { failed, report } from "@/lib/ops/fault";
import { presenterGenders, renderScript, videoEnabled, videoVoice } from "@/lib/video";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { characterById } from "@/lib/characters";
import { generateLessonScript, SCRIPT_VERSION, VISUALS_VERSION, type LessonScript } from "@/lib/ai/lesson-script";
import { answerInLesson } from "@/lib/ai/lesson-answer";
import { enrichBeats } from "@/lib/teach/enrich";
import { learnerPromptLine } from "@/lib/learner";
import { classifyRisk } from "@/lib/ai/coach-chat";
import type { Topic } from "@/lib/types";

const PATHS = ["/teach", "/today", "/learn", "/parent/progress"];
const LESSON_POINTS = 10;

export async function chooseCharacterAction(characterId: string): Promise<void> {
  const { profile } = await requireStudent();
  const supabase = await createClient();
  await supabase.from("profiles").update({ character_id: characterById(characterId).id }).eq("id", profile.id);
  PATHS.forEach((p) => revalidatePath(p));
}

/** Starts a lesson on a curriculum topic or a school file: reuses the cached script, or writes it now. */
export async function startLessonAction(source: { topicId?: string; materialId?: string }): Promise<{ error?: string }> {
  const { profile, family } = await requireStudent();
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not configured on the server." };
  const character = characterById(profile.character_id);
  const admin = createAdminClient();
  let scriptId: string | null = null;
  let language: "en" | "ar" = "en";
  let topic: Topic | null = null;
  let material: { id: string; title: string; subject: string | null; digest: string | null; language: string | null } | null = null;
  // The teacher performs at the depth this child is entitled to; the two are cached and fetched separately.
  const level = await defaultLevel(profile.id, family.id);
  if (source.topicId) {
    const { data } = await admin.from("topics").select("*").eq("id", source.topicId).maybeSingle();
    topic = data as Topic | null;
    if (!topic) return { error: "Topic not found." };
    language = topic.language ?? "en";
    const { data: cached } = await admin.from("lesson_scripts").select("id").eq("topic_id", topic.id).eq("character_id", character.id).eq("language", language).eq("level", level).is("flagged_at", null).gte("version", SCRIPT_VERSION).order("version", { ascending: false }).limit(1).maybeSingle();
    scriptId = cached?.id ?? null;
  } else if (source.materialId) {
    const { data } = await admin.from("materials").select("id, title, subject, digest, language").eq("id", source.materialId).eq("student_id", profile.id).maybeSingle();
    material = data;
    if (!material?.digest) return { error: "This file has not been read yet." };
    language = material.language === "arabic" ? "ar" : "en";
    const { data: cached } = await admin.from("lesson_scripts").select("id").eq("material_id", material.id).eq("character_id", character.id).eq("level", level).is("flagged_at", null).gte("version", SCRIPT_VERSION).order("version", { ascending: false }).limit(1).maybeSingle();
    scriptId = cached?.id ?? null;
  } else {
    return { error: "Pick a topic or a file." };
  }
  if (!scriptId) {
    let script: LessonScript & { model: string };
    try {
      script = await generateLessonScript({
        subject: topic?.subject ?? material?.subject ?? "School",
        unit: topic?.unit ?? null,
        topic: topic?.name ?? material?.title ?? "Lesson",
        grade: topic?.grade ?? profile.grade,
        language,
        character,
        sourceText: material?.digest ?? null,
        learner: learnerPromptLine(profile.learner_profile),
        interests: profile.interests,
        level,
      });
    } catch (err) {
      return failed("actions.teach.startLesson", err, "Could not write the lesson.");
    }
    const { model, ...body } = script;
    // The words are enough to begin. Drawing every scene costs another minute of the strongest model, and the
    // child would spend it looking at a spinner, so the lesson is saved and opened now and illustrated behind it.
    // visuals_version 0 means "being drawn": the stage shows "pictures coming" and does not start a second pass.
    const { data: row, error } = await admin
      .from("lesson_scripts")
      .insert({ topic_id: topic?.id ?? null, material_id: material?.id ?? null, character_id: character.id, language, level, grade: topic?.grade ?? profile.grade, title: body.title, minutes: body.minutes, script: { beats: body.beats, quiz: body.quiz }, model, version: SCRIPT_VERSION, visuals_version: 0, visuals_started_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error || !row) return failed("actions.teach.startLesson", error, "Could not save the lesson.");
    scriptId = row.id;
    const newId = row.id as string;
    const ctx = { subject: topic?.subject ?? material?.subject ?? "School", topic: topic?.name ?? material?.title ?? "Lesson", language };
    after(async () => {
      try {
        const beats = await enrichBeats(body.beats, ctx);
        await admin.from("lesson_scripts").update({ script: { beats, quiz: body.quiz }, visuals_version: VISUALS_VERSION }).eq("id", newId);
      } catch (err) {
        // Leave it unclaimed so opening the lesson again picks the drawing up — and say what went wrong,
        // because a lesson that is never illustrated otherwise fails in complete silence.
        await report("teach.enrichBeats", err, { meta: { scriptId: newId } });
        await admin.from("lesson_scripts").update({ visuals_version: null }).eq("id", newId);
      }
    });
  }
  const { data: session, error: sErr } = await admin.from("lesson_sessions").insert({ student_id: profile.id, family_id: family.id, script_id: scriptId, character_id: character.id }).select("id").single();
  if (sErr || !session) return failed("actions.teach.startLesson", sErr, "Could not start the lesson.");
  // Presenter clips render in the background from the first line, so most are ready before the child reaches them.
  if (videoEnabled()) {
    const voice = videoVoice(character, language, null, (await presenterGenders())[character.id]);
    const sid = scriptId;
    if (voice) after(async () => {
      const { data } = await admin.from("lesson_scripts").select("script, title").eq("id", sid).maybeSingle();
      const beats = ((data?.script as { beats?: { kind: string; say: string; check?: { explanation?: string | null; hint?: string | null } | null }[] } | null)?.beats ?? []).map((b) => ({ kind: b.kind, say: b.say, check: b.check ?? null }));
      await renderScript({ characterId: character.id, voice, beats, title: data?.title ?? "", language });
    });
  }
  redirect(`/teach/${session.id}`);
}

/** Progress and check outcomes, saved as the lesson goes so a reload resumes where he was. */
export async function recordBeatAction(sessionId: string, beatIndex: number, check?: { correct: boolean; attempts: number }): Promise<void> {
  const { profile } = await requireStudent();
  const admin = createAdminClient();
  const { data: s } = await admin.from("lesson_sessions").select("checks").eq("id", sessionId).eq("student_id", profile.id).maybeSingle();
  if (!s) return;
  const checks = ((s.checks ?? []) as { beat: number; correct: boolean; attempts: number }[]).filter((c) => c.beat !== beatIndex);
  if (check) checks.push({ beat: beatIndex, ...check });
  await admin.from("lesson_sessions").update({ beat_index: beatIndex, checks }).eq("id", sessionId);
}

/** "Raise your hand": a question answered in character, kept on record (labels for the parent). */
export async function askTeacherAction(sessionId: string, beatIndex: number, question: string): Promise<{ answer?: string; error?: string }> {
  const { profile } = await requireStudent();
  const q = question.trim().slice(0, 400);
  if (q.length < 2) return { error: "Ask something first." };
  const admin = createAdminClient();
  const { data: s } = await admin.from("lesson_sessions").select("id, character_id, lesson_scripts(script, title, language)").eq("id", sessionId).eq("student_id", profile.id).maybeSingle();
  const row = s as unknown as { id: string; character_id: string; lesson_scripts: { script: { beats: LessonScript["beats"]; quiz: LessonScript["quiz"] }; title: string; language: string } | null } | null;
  if (!row?.lesson_scripts) return { error: "Lesson not found." };
  const { data: prior } = await admin.from("lesson_questions").select("question, answer").eq("session_id", sessionId).order("created_at").limit(6);
  try {
    const answer = await answerInLesson({ character: characterById(row.character_id), script: { title: row.lesson_scripts.title, minutes: 10, ...row.lesson_scripts.script }, beatIndex, question: q, language: row.lesson_scripts.language === "ar" ? "ar" : "en", history: (prior ?? []) as { question: string; answer: string }[] });
    await admin.from("lesson_questions").insert({ session_id: sessionId, student_id: profile.id, beat_index: beatIndex, question: q, answer });
    // The teacher is not the coach, but a distressed message still reaches the coach's safety path as a private note.
    if (process.env.ANTHROPIC_API_KEY) classifyRisk(q).then((r) => { if (r.risk_level !== "none" && r.private_note) return admin.from("coach_notes").insert({ student_id: profile.id, note: r.private_note, source: "lesson" }); }).catch(() => null);
    return { answer };
  } catch (err) {
    return failed("actions.teach.askTeacher", err, "The teacher could not answer.");
  }
}

/** Ends the lesson: understanding from the checks, a 3-question quiz for mastery, points once. */
export async function finishLessonAction(sessionId: string, seconds: number): Promise<{ error?: string }> {
  const { profile } = await requireStudent();
  const admin = createAdminClient();
  const { data: s } = await admin.from("lesson_sessions").select("id, checks, quiz_id, finished_at, lesson_scripts(id, topic_id, material_id, title, language, script)").eq("id", sessionId).eq("student_id", profile.id).maybeSingle();
  const row = s as unknown as { id: string; checks: { correct: boolean }[]; quiz_id: string | null; finished_at: string | null; lesson_scripts: { id: string; topic_id: string | null; material_id: string | null; title: string; language: string; script: { quiz: LessonScript["quiz"] } } | null } | null;
  if (!row?.lesson_scripts) return { error: "Lesson not found." };
  if (row.quiz_id) redirect(`/quiz/${row.quiz_id}`);
  const checks = row.checks ?? [];
  const ok = checks.filter((c) => c.correct).length;
  const understanding = checks.length === 0 ? "shaky" : ok / checks.length >= 0.75 ? "understood" : ok / checks.length >= 0.4 ? "shaky" : "lost";
  const qs = row.lesson_scripts.script.quiz;
  const { data: quiz, error } = await admin
    .from("quizzes")
    .insert({ student_id: profile.id, topic_id: row.lesson_scripts.topic_id, track: "school", title: `Lesson quiz: ${row.lesson_scripts.title}`, passage: null, difficulty: "medium", language: row.lesson_scripts.language === "ar" ? "ar" : "en", material_id: row.lesson_scripts.material_id })
    .select("id")
    .single();
  if (error || !quiz) return failed("actions.teach.finishLesson", error, "Could not create the quiz.");
  const { data: rows } = await admin.from("quiz_questions").insert(qs.map((q, i) => ({ quiz_id: quiz.id, position: i + 1, prompt: q.prompt, choices: q.choices, skill_tag: q.skill_tag }))).select("id, position");
  if (rows?.length) await admin.from("quiz_answer_keys").insert(rows.map((r) => ({ question_id: r.id, correct_index: qs[r.position - 1].correct_index, explanation: qs[r.position - 1].explanation })));
  await admin.from("lesson_sessions").update({ finished_at: new Date().toISOString(), understanding, quiz_id: quiz.id, seconds: Math.max(0, Math.round(seconds)) }).eq("id", sessionId);
  if (!row.finished_at) await admin.from("points_ledger").insert({ student_id: profile.id, delta: LESSON_POINTS, reason: `Lesson with the teacher: ${row.lesson_scripts.title}`, ref_type: "lesson", ref_id: sessionId });
  PATHS.forEach((p) => revalidatePath(p));
  redirect(`/quiz/${quiz.id}`);
}

/** A parent or the child flags a wrong fact; the script is regenerated next time on the best model. */
export async function flagLessonAction(scriptId: string): Promise<void> {
  await requireStudent();
  const admin = createAdminClient();
  await admin.from("lesson_scripts").update({ flagged_at: new Date().toISOString() }).eq("id", scriptId);
}
