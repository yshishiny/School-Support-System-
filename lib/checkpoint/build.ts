import { createAdminClient } from "@/lib/supabase/admin";
import { generateQuiz } from "@/lib/ai/generate-quiz";
import { weekFor } from "@/lib/allowance";
import { shiftDate, prettyDate } from "@/lib/dates";
import { learnerPromptLine } from "@/lib/learner";
import { themeById } from "@/lib/themes";
import { sendPush } from "@/lib/push/server";
import { sendTelegram } from "@/lib/whatsapp/send";
import { checkpointResult, type ClaimedSubject } from "@/lib/checkpoint";
import type { Profile } from "@/lib/types";

const NO_CLASS = /^no class/i;

export interface CreateCheckpointInput {
  studentId: string;
  familyId: string;
  kind: "weekly" | "spot";
  subject?: string | null; // spot checks
  requestedBy?: string | null;
  today: string;
  payWeekday: number;
}

/** What was claimed this week per subject (class-log lessons that were not "No class"). */
export async function claimedThisWeek(studentId: string, start: string, end: string, subject?: string | null): Promise<{ claimed: ClaimedSubject[]; notes: string[]; digests: string[] }> {
  const admin = createAdminClient();
  const [{ data: logs }, { data: materials }] = await Promise.all([
    admin.from("lesson_logs").select("log_date, subject_name, note").eq("student_id", studentId).gte("log_date", start).lte("log_date", end).order("log_date"),
    admin.from("materials").select("subject, title, digest, created_at").eq("student_id", studentId).eq("status", "ready").gte("created_at", new Date(shiftDate(start, -7) + "T00:00:00Z").toISOString()),
  ]);
  const rows = (logs ?? []).filter((l) => !NO_CLASS.test(l.note.trim()) && (!subject || l.subject_name.toLowerCase() === subject.toLowerCase()));
  const counts = new Map<string, number>();
  for (const l of rows) counts.set(l.subject_name, (counts.get(l.subject_name) ?? 0) + 1);
  const claimed = [...counts].map(([s, n]) => ({ subject: s, lessons: n }));
  const notes = rows.map((l) => `${l.subject_name} (${l.log_date}): ${l.note}`);
  const digests = (materials ?? []).filter((m) => m.digest && (!subject || (m.subject ?? "").toLowerCase() === subject.toLowerCase())).map((m) => `FILE "${m.title}"${m.subject ? ` (${m.subject})` : ""}:\n${m.digest}`);
  return { claimed, notes, digests };
}

/** Builds the checkpoint quiz and notifies the child. Returns the checkpoint id, or an error. */
export async function createCheckpoint(i: CreateCheckpointInput): Promise<{ id?: string; error?: string; questions?: number }> {
  const admin = createAdminClient();
  const { data: student } = await admin.from("profiles").select("*").eq("id", i.studentId).single();
  if (!student) return { error: "Student not found." };
  const p = student as Profile & { telegram_chat_id: string | null };
  const { start, end } = weekFor(i.today, i.payWeekday);
  const { claimed, notes, digests } = await claimedThisWeek(i.studentId, start, i.today, i.subject);
  if (notes.length < (i.kind === "spot" ? 1 : 2) && digests.length === 0) return { error: i.subject ? `Nothing logged in ${i.subject} this week to test on.` : "Fewer than two lessons logged this week: nothing to test on yet." };
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not configured on the server." };
  const dueBy = i.kind === "weekly" ? end : shiftDate(i.today, 2);
  const timeLimit = i.kind === "weekly" ? 20 : 12;
  const count = i.kind === "weekly" ? 15 : 10;
  const { data: cp, error: cpErr } = await admin
    .from("checkpoints")
    .insert({ student_id: i.studentId, family_id: i.familyId, kind: i.kind, week_start: start, subject: i.subject ?? null, time_limit_min: timeLimit, due_by: dueBy, requested_by: i.requestedBy ?? null })
    .select("id")
    .single();
  if (cpErr || !cp) return { error: cpErr?.message ?? "Could not create the checkpoint." };
  try {
    // Avoid repeating this week's questions.
    const { data: weekQuizzes } = await admin.from("quizzes").select("id").eq("student_id", i.studentId).gte("created_at", new Date(start + "T00:00:00Z").toISOString());
    const ids = (weekQuizzes ?? []).map((q) => q.id);
    const { data: prior } = ids.length ? await admin.from("quiz_questions").select("prompt").in("quiz_id", ids) : { data: [] };
    const generated = await generateQuiz({
      track: "school",
      grade: p.grade,
      subject: i.subject ?? "Weekly checkpoint across this week's subjects",
      unit: null,
      topic: i.subject ? `what the student logged in ${i.subject} this week` : "what the student logged at school this week",
      actSection: null,
      difficulty: "medium",
      count,
      weakSkills: [],
      avoidPrompts: (prior ?? []).map((q) => q.prompt),
      recallNotes: notes,
      sourceText: digests.length ? digests.join("\n\n").slice(0, 14000) : null,
      language: "en",
      interests: null,
      themeName: themeById(p.theme).name,
      learner: learnerPromptLine(p.learner_profile),
      checkpoint: true,
    });
    const { data: quiz, error } = await admin
      .from("quizzes")
      .insert({ student_id: i.studentId, topic_id: null, track: "school", title: i.kind === "weekly" ? `Weekly checkpoint · week of ${prettyDate(start)}` : `Spot check · ${i.subject ?? "this week"}`, passage: generated.passage, difficulty: "medium", language: "en", checkpoint_id: cp.id, time_limit_min: timeLimit })
      .select("id")
      .single();
    if (error || !quiz) throw new Error(error?.message ?? "Could not save the quiz.");
    const { data: rows, error: qErr } = await admin
      .from("quiz_questions")
      .insert(generated.questions.map((q, k) => ({ quiz_id: quiz.id, position: k + 1, prompt: q.prompt, choices: q.choices, skill_tag: q.skill_tag })))
      .select("id, position");
    if (qErr || !rows) throw new Error(qErr?.message ?? "Could not save the questions.");
    await admin.from("quiz_answer_keys").insert(rows.map((r) => ({ question_id: r.id, correct_index: generated.questions[r.position - 1].correct_index, explanation: generated.questions[r.position - 1].explanation })));
    await admin.from("checkpoints").update({ quiz_id: quiz.id }).eq("id", cp.id);
    const text = i.kind === "weekly"
      ? `🎯 ${p.full_name.split(" ")[0]}, your weekly checkpoint is ready: ${rows.length} questions on what you logged this week, ${timeLimit} minutes, one attempt, by ${prettyDate(dueBy)}. Study first, then go.`
      : `🎯 ${p.full_name.split(" ")[0]}, a spot check on ${i.subject ?? "this week"}: ${rows.length} questions, ${timeLimit} minutes, one attempt, by ${prettyDate(dueBy)}.`;
    await sendPush(i.studentId, { title: i.kind === "weekly" ? "Weekly checkpoint" : "Spot check", body: text, url: `/quiz/${quiz.id}`, tag: "checkpoint" }).catch(() => null);
    if (p.telegram_chat_id) await sendTelegram(p.telegram_chat_id, `${text} ${process.env.NEXT_PUBLIC_APP_URL ?? "https://school-support-system.vercel.app"}/quiz/${quiz.id}`).catch(() => null);
    return { id: cp.id, questions: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from("checkpoints").update({ status: "failed", error: msg }).eq("id", cp.id);
    return { error: msg };
  }
}

/** After the attempt is submitted: score per subject against what was claimed, stored on the checkpoint. */
export async function settleCheckpoint(checkpointId: string, attemptId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: cp } = await admin.from("checkpoints").select("id, student_id, week_start, subject, due_by").eq("id", checkpointId).maybeSingle();
  if (!cp) return;
  const { data: answers } = await admin.from("attempt_answers").select("correct, quiz_questions(skill_tag)").eq("attempt_id", attemptId);
  const list = ((answers ?? []) as unknown as { correct: boolean; quiz_questions: { skill_tag: string | null } | null }[]).map((a) => ({ correct: a.correct, skill_tag: a.quiz_questions?.skill_tag ?? null }));
  const { claimed } = await claimedThisWeek(cp.student_id, cp.week_start, cp.due_by, cp.subject);
  const result = checkpointResult(list, claimed);
  await admin.from("checkpoints").update({ status: "done", result }).eq("id", checkpointId);
}

/** Nightly: create the weekly checkpoint the day before pay day for every child with enough logged, and expire stale ones. */
export async function runWeeklyCheckpoints(today: string): Promise<string[]> {
  const admin = createAdminClient();
  const out: string[] = [];
  await admin.from("checkpoints").update({ status: "expired" }).eq("status", "ready").lt("due_by", today);
  const { data: fams } = await admin.from("families").select("id, timezone, allowance_pay_weekday");
  const { data: students } = await admin.from("profiles").select("id, family_id, full_name").eq("role", "student");
  for (const s of students ?? []) {
    const fam = (fams ?? []).find((f) => f.id === s.family_id);
    if (!fam) continue;
    const wd = new Date(today + "T00:00:00Z").getUTCDay();
    if ((wd + 1) % 7 !== fam.allowance_pay_weekday) continue; // the day before pay day
    const { start } = weekFor(today, fam.allowance_pay_weekday);
    const { data: existing } = await admin.from("checkpoints").select("id").eq("student_id", s.id).eq("kind", "weekly").eq("week_start", start).limit(1);
    if (existing?.length) continue;
    const r = await createCheckpoint({ studentId: s.id, familyId: s.family_id, kind: "weekly", today, payWeekday: fam.allowance_pay_weekday });
    out.push(`${s.full_name.split(" ")[0]}: ${r.error ?? `${r.questions} questions`}`);
  }
  return out;
}
