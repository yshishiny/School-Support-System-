"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireParent, requireSession, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateQuiz } from "@/lib/ai/generate-quiz";
import { explainTopic } from "@/lib/ai/explain-topic";
import { integrityFlag, nextReview, quizPoints, QUIZ_POINTS } from "@/lib/learning";
import { EXAM_SECTIONS, secondsPerQuestion } from "@/lib/exams";
import { todayIn } from "@/lib/dates";
import type { Topic } from "@/lib/types";

const QUESTIONS_PER_SET = 8;

/** Writes (or returns) the cached lesson for a topic at the student's grade. */
export async function explainTopicAction(_prev: { error?: string } | undefined, formData: FormData) {
  const { profile } = await requireSession();
  const topicId = String(formData.get("topic_id"));
  const supabase = await createClient();
  const { data: topic } = await supabase.from("topics").select("*").eq("id", topicId).single();
  if (!topic) return { error: "Topic not found." };
  const t = topic as Topic;
  const grade = t.track === "school" ? (t.grade ?? profile.grade) : null;
  const admin = createAdminClient();
  const { data: existing } = await admin.from("lessons").select("id").eq("topic_id", topicId).filter("grade", grade === null ? "is" : "eq", grade).maybeSingle();
  if (existing) return {};
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not configured on the server." };
  try {
    const { content, model } = await explainTopic({ grade, subject: t.subject, unit: t.unit, topic: t.name, track: t.track });
    await admin.from("lessons").upsert({ topic_id: topicId, grade, content_md: content, model }, { onConflict: "topic_id,grade" });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not write the lesson." };
  }
  revalidatePath(`/learn/topic/${topicId}`);
  return {};
}

/** Generates a practice set for a topic or a mixed ACT section and sends the student to it. */
export async function createQuizAction(_prev: { error?: string } | undefined, formData: FormData) {
  const { profile, family } = await requireStudent();
  const topicId = String(formData.get("topic_id") ?? "") || null;
  const actSection = String(formData.get("act_section") ?? "") || null;
  const recall = String(formData.get("recall") ?? "") === "1";
  const difficulty = (String(formData.get("difficulty") ?? "medium") as "easy" | "medium" | "hard") || "medium";
  if (!topicId && !actSection && !recall) return { error: "Choose a topic or an exam section." };
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not configured on the server." };

  const supabase = await createClient();
  const admin = createAdminClient();
  let topic: Topic | null = null;
  if (topicId) {
    const { data } = await supabase.from("topics").select("*").eq("id", topicId).single();
    topic = data as Topic | null;
    if (!topic) return { error: "Topic not found." };
  }

  // Daily recall: questions on what the student wrote they covered at school today.
  const today = todayIn(family.timezone);
  let recallNotes: string[] = [];
  if (recall) {
    const { data: logs } = await admin.from("lesson_logs").select("subject_name, note").eq("student_id", profile.id).eq("log_date", today);
    recallNotes = (logs ?? []).map((l) => `${l.subject_name}: ${l.note}`);
    if (recallNotes.length === 0) return { error: "Write what you covered today in the check-in first." };
  }

  // Weak skills and previously seen prompts, so sets adapt and do not repeat.
  const scope = admin.from("quizzes").select("id").eq("student_id", profile.id);
  const { data: priorQuizzes } = topicId ? await scope.eq("topic_id", topicId) : recall ? await scope.eq("recall_date", today) : await scope.eq("act_section", actSection!);
  const priorIds = (priorQuizzes ?? []).map((q) => q.id);
  let avoid: string[] = [];
  let weak: string[] = [];
  if (priorIds.length) {
    const { data: qs } = await admin.from("quiz_questions").select("id, prompt, skill_tag").in("quiz_id", priorIds);
    avoid = (qs ?? []).map((q) => q.prompt);
    const { data: wrong } = await admin
      .from("attempt_answers")
      .select("question_id, correct")
      .in("question_id", (qs ?? []).map((q) => q.id))
      .eq("correct", false);
    const tagOf = new Map((qs ?? []).map((q) => [q.id, q.skill_tag]));
    weak = [...new Set((wrong ?? []).map((w) => tagOf.get(w.question_id)).filter((x): x is string => !!x))].slice(0, 6);
  }

  const sectionInfo = actSection ? EXAM_SECTIONS[actSection] : null;
  const track: "school" | "act" | "sat" = topic ? topic.track : recall ? "school" : sectionInfo?.exam === "SAT" ? "sat" : "act";
  let generated;
  try {
    generated = await generateQuiz({
      track,
      grade: track === "school" ? (topic?.grade ?? profile.grade) : null,
      subject: recall ? "Today's lessons (daily recall)" : topic?.subject ?? `${sectionInfo?.exam === "BOTH" ? "SAT and ACT" : sectionInfo?.exam ?? "ACT"} ${sectionInfo?.label ?? actSection}`,
      unit: topic?.unit ?? null,
      topic: recall ? "what the student covered at school today" : topic?.name ?? (actSection === "mixed" ? "mixed SAT + ACT set across all sections" : "mixed skills across the whole section"),
      actSection: topic?.act_section ?? actSection,
      difficulty,
      count: topic ? QUESTIONS_PER_SET : sectionInfo?.setSize ?? QUESTIONS_PER_SET,
      weakSkills: weak,
      avoidPrompts: avoid,
      recallNotes,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not generate the quiz." };
  }

  const { data: quiz, error } = await admin
    .from("quizzes")
    .insert({
      student_id: profile.id,
      topic_id: topicId,
      track,
      act_section: topic?.act_section ?? actSection,
      recall_date: recall ? today : null,
      title: generated.title,
      passage: generated.passage,
      difficulty,
    })
    .select()
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
  await admin.from("quiz_answer_keys").insert(
    questions.map((row) => {
      const src = generated.questions[row.position - 1];
      return { question_id: row.id, correct_index: src.correct_index, explanation: src.explanation };
    }),
  );
  redirect(`/quiz/${quiz.id}`);
}

/** Ensures there is one open attempt for this quiz and returns its id. */
export async function ensureAttempt(quizId: string): Promise<string> {
  const { profile } = await requireStudent();
  const admin = createAdminClient();
  const { data: open } = await admin.from("attempts").select("id").eq("student_id", profile.id).eq("quiz_id", quizId).is("submitted_at", null).maybeSingle();
  if (open) return open.id;
  const { data } = await admin.from("attempts").insert({ student_id: profile.id, quiz_id: quizId, kind: "quiz" }).select("id").single();
  return data!.id;
}

export interface AnswerResult {
  correct: boolean;
  correct_index: number;
  explanation: string;
}

export async function answerQuestionAction(
  attemptId: string | null,
  questionId: string,
  chosenIndex: number,
  seconds: number,
  quizId?: string,
): Promise<AnswerResult & { attemptId: string }> {
  const { profile } = await requireStudent();
  const admin = createAdminClient();
  if (!attemptId) {
    if (!quizId) throw new Error("Missing quiz.");
    attemptId = await ensureAttempt(quizId);
  }
  const { data: attempt } = await admin.from("attempts").select("id, submitted_at").eq("id", attemptId).eq("student_id", profile.id).single();
  if (!attempt || attempt.submitted_at) throw new Error("This attempt is closed.");
  const { data: key } = await admin.from("quiz_answer_keys").select("*").eq("question_id", questionId).single();
  if (!key) throw new Error("Question not found.");
  const correct = key.correct_index === chosenIndex;
  await admin
    .from("attempt_answers")
    .upsert({ attempt_id: attemptId, question_id: questionId, chosen_index: chosenIndex, correct, seconds: Math.max(0, Math.round(seconds)) }, { onConflict: "attempt_id,question_id" });
  return { attemptId, correct, correct_index: key.correct_index, explanation: key.explanation };
}

export interface FinishResult {
  score: number;
  total: number;
  earned: number;
  flag: string | null;
}

export async function finishAttemptAction(attemptId: string, tabSwitches: number, total: number): Promise<FinishResult> {
  const { profile, family } = await requireStudent();
  const admin = createAdminClient();
  const today = todayIn(family.timezone);
  const { data: attempt } = await admin.from("attempts").select("*, quizzes(act_section, scheduled_for)").eq("id", attemptId).eq("student_id", profile.id).single();
  if (!attempt) throw new Error("Attempt not found.");
  if (attempt.submitted_at) return { score: attempt.score, total: attempt.total, earned: 0, flag: attempt.flag_reason };

  const { data: answers } = await admin.from("attempt_answers").select("*").eq("attempt_id", attemptId);
  const list = answers ?? [];
  const score = list.filter((a) => a.correct).length;
  const seconds = list.reduce((s, a) => s + a.seconds, 0);
  const quizMeta = (attempt as { quizzes?: { act_section?: string | null; scheduled_for?: string | null } | null }).quizzes ?? null;
  const section = quizMeta?.act_section ?? null;
  const flag = integrityFlag({
    secondsPerAnswer: list.map((a) => a.seconds),
    score,
    total,
    tabSwitches,
    minReasonableSeconds: section ? Math.round(secondsPerQuestion(section) / 4) : 6,
  });

  await admin
    .from("attempts")
    .update({ submitted_at: new Date().toISOString(), score, total, seconds, tab_switches: tabSwitches, flagged: !!flag, flag_reason: flag })
    .eq("id", attemptId);

  // Spaced repetition: every answered question gets a next due date.
  const { data: queue } = await admin.from("review_queue").select("*").eq("student_id", profile.id).in("question_id", list.map((a) => a.question_id));
  const byQ = new Map((queue ?? []).map((q) => [q.question_id, q]));
  const upserts = list.map((a) => {
    const prev = byQ.get(a.question_id) ?? null;
    const next = nextReview(prev ? { interval_days: prev.interval_days, lapses: prev.lapses } : null, a.correct, today);
    return { student_id: profile.id, question_id: a.question_id, ...next, updated_at: new Date().toISOString() };
  });
  if (upserts.length) await admin.from("review_queue").upsert(upserts, { onConflict: "student_id,question_id" });

  // Points, with a daily cap on practice points and no pay for flagged attempts.
  let earned = 0;
  if (!flag) {
    const dayStart = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: todayPts } = await admin.from("points_ledger").select("delta").eq("student_id", profile.id).eq("ref_type", "attempt").gte("created_at", dayStart);
    const already = (todayPts ?? []).reduce((s, r) => s + r.delta, 0);
    earned = quizPoints(score, total, attempt.kind, already);
    if (earned > 0) {
      const { error } = await admin.from("points_ledger").insert({
        student_id: profile.id,
        delta: earned,
        reason: attempt.kind === "review" ? `Review session ${score}/${total}` : `Practice set ${score}/${total}`,
        ref_type: "attempt",
        ref_id: attemptId,
      });
      if (error) earned = 0;
    }
    // Weekly plan: a small extra for doing the planned quiz on its day (outside the daily cap, once per quiz).
    if (quizMeta?.scheduled_for === today && attempt.quiz_id) {
      const { error } = await admin.from("points_ledger").insert({
        student_id: profile.id,
        delta: QUIZ_POINTS.PLANNED_ON_DAY,
        reason: "Planned quiz done on its day",
        ref_type: "planned",
        ref_id: attempt.quiz_id,
      });
      if (!error) earned += QUIZ_POINTS.PLANNED_ON_DAY;
    }
  }
  ["/learn", "/today", "/review", "/rewards", "/parent", "/parent/progress", "/parent/plan"].forEach((p) => revalidatePath(p));
  return { score, total, earned, flag };
}

/** Builds a review attempt from due questions. Returns null when nothing is due. */
export async function startReviewAttempt(limit = 10): Promise<{ attemptId: string; questionIds: string[] } | null> {
  const { profile, family } = await requireStudent();
  const admin = createAdminClient();
  const today = todayIn(family.timezone);
  const { data: open } = await admin.from("attempts").select("id").eq("student_id", profile.id).eq("kind", "review").is("submitted_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (open) {
    // Reuse: questions are the ones still due.
    const { data: due } = await admin.from("review_queue").select("question_id").eq("student_id", profile.id).lte("due_date", today).order("due_date").limit(limit);
    if (!due || due.length === 0) return null;
    return { attemptId: open.id, questionIds: due.map((d) => d.question_id) };
  }
  const { data: due } = await admin.from("review_queue").select("question_id").eq("student_id", profile.id).lte("due_date", today).order("due_date").limit(limit);
  if (!due || due.length === 0) return null;
  const { data } = await admin.from("attempts").insert({ student_id: profile.id, kind: "review" }).select("id").single();
  return { attemptId: data!.id, questionIds: due.map((d) => d.question_id) };
}

export async function setTargetExamAction(formData: FormData) {
  await requireParent();
  const supabase = await createClient();
  const studentId = String(formData.get("student_id"));
  const raw = String(formData.get("target_exam") ?? "").trim();
  const exam = raw === "ACT" || raw === "SAT" || raw === "BOTH" ? raw : null;
  const date = String(formData.get("target_exam_date") ?? "") || null;
  await supabase.from("profiles").update({ target_exam: exam, target_exam_date: date }).eq("id", studentId);
  revalidatePath("/parent/progress");
  revalidatePath("/learn");
  revalidatePath("/today");
}
