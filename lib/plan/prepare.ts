import { createAdminClient } from "@/lib/supabase/admin";
import { generateQuiz } from "@/lib/ai/generate-quiz";
import { planSlots, type PlanSlot } from "@/lib/plan";
import { EXAM_SECTIONS, examsFor } from "@/lib/exams";
import { shiftDate, todayIn } from "@/lib/dates";
import { masteryMaps, type AttemptWithQuiz } from "@/lib/mastery";
import type { Profile, Topic } from "@/lib/types";
import { themeById } from "@/lib/themes";
import { learnerPromptLine } from "@/lib/learner";
import type { Level } from "@/lib/plan";

const SCHOOL_SET_SIZE = 8;

export interface PlannedQuiz {
  id: string;
  title: string;
  scheduled_for: string;
  plan_slot: "school" | "exam" | "arabic";
  topic_id: string | null;
  act_section: string | null;
  attempts: { score: number | null; total: number | null; submitted_at: string | null }[];
}

export interface PlanOverview {
  today: string;
  profile: Profile;
  wanted: PlanSlot[];
  missing: PlanSlot[];
  quizzes: PlannedQuiz[];
  topicsById: Map<string, Topic>;
}

/** Loads everything the planner needs for one student and computes the wanted / missing slots for the next 7 days. */
export async function loadPlan(studentId: string): Promise<PlanOverview> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", studentId).eq("role", "student").single();
  if (!profile) throw new Error("Student not found.");
  const p = profile as Profile;
  const { data: family } = await admin.from("families").select("timezone").eq("id", p.family_id).single();
  const today = todayIn(family?.timezone ?? "Africa/Cairo");
  const windowEnd = shiftDate(today, 6);

  const [{ data: timetable }, { data: topics }, { data: attempts }, { data: quizzes }, { data: covered }, { data: coach }] = await Promise.all([
    admin.from("timetable_entries").select("weekday, subject_name").eq("student_id", studentId).order("weekday").order("start_time"),
    admin.from("topics").select("*").eq("track", "school").eq("grade", p.grade ?? 0).order("subject").order("sort"),
    admin.from("attempts").select("*, quizzes(topic_id, act_section, track, title)").eq("student_id", studentId).not("submitted_at", "is", null),
    admin
      .from("quizzes")
      .select("id, title, scheduled_for, plan_slot, topic_id, act_section, attempts(score, total, submitted_at)")
      .eq("student_id", studentId)
      .not("scheduled_for", "is", null)
      .gte("scheduled_for", shiftDate(today, -6))
      .lte("scheduled_for", windowEnd)
      .order("scheduled_for"),
    admin.from("lesson_logs").select("topic_id").eq("student_id", studentId).not("topic_id", "is", null).gte("log_date", shiftDate(today, -14)),
    admin.from("coach_reports").select("levels").eq("student_id", studentId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const allTopics = (topics ?? []) as Topic[];
  const { topic: mastery } = masteryMaps((attempts ?? []) as AttemptWithQuiz[]);
  const planned = (quizzes ?? []) as PlannedQuiz[];
  const { wanted, missing } = planSlots({
    today,
    timetable: timetable ?? [],
    topics: allTopics.map((t) => ({ id: t.id, subject: t.subject, name: t.name, sort: t.sort })),
    exams: examsFor(p.target_exam, p.grade),
    mastery,
    existing: planned.filter((q) => q.scheduled_for >= today),
    covered: new Set((covered ?? []).map((c) => c.topic_id as string)),
    levels: ((coach?.levels as Record<string, Level> | null) ?? {}),
    favourites: p.favourite_subjects ?? [],
  });
  return { today, profile: p, wanted, missing, quizzes: planned, topicsById: new Map(allTopics.map((t) => [t.id, t])) };
}

export interface PrepareResult {
  made: string | null; // title of the quiz just written, or null when nothing was missing
  remaining: number; // slots still missing after this call
  error?: string;
}

/** Generates the next missing quiz in the student's 7-day plan. One quiz per call so each call fits a single request. */
export async function prepareNextPlannedQuiz(studentId: string): Promise<PrepareResult> {
  const plan = await loadPlan(studentId);
  if (plan.missing.length === 0) return { made: null, remaining: 0 };
  const slot = plan.missing[0];
  if (!process.env.ANTHROPIC_API_KEY) return { made: null, remaining: plan.missing.length, error: "ANTHROPIC_API_KEY is not configured on the server." };
  const admin = createAdminClient();
  const topic = slot.topicId ? plan.topicsById.get(slot.topicId) ?? null : null;
  const section = slot.actSection ? EXAM_SECTIONS[slot.actSection] : null;

  // Prompts already used for the same topic or section, so the new set does not repeat them.
  const scope = admin.from("quizzes").select("id").eq("student_id", studentId);
  const { data: prior } = topic ? await scope.eq("topic_id", topic.id) : await scope.eq("act_section", slot.actSection!);
  const priorIds = (prior ?? []).map((q) => q.id);
  const { data: priorQs } = priorIds.length ? await admin.from("quiz_questions").select("prompt").in("quiz_id", priorIds).limit(30) : { data: [] };

  const track: "school" | "act" | "sat" = topic ? "school" : section?.exam === "SAT" ? "sat" : "act";
  let generated;
  try {
    generated = await generateQuiz({
      track,
      grade: topic ? plan.profile.grade : null,
      subject: topic ? topic.subject : `${section?.exam === "BOTH" ? "SAT and ACT" : section?.exam ?? "ACT"} ${section?.label ?? slot.actSection}`,
      unit: topic?.unit ?? null,
      topic: topic ? topic.name : slot.actSection === "mixed" ? "mixed SAT + ACT set across all sections" : "mixed skills across the whole section",
      actSection: slot.actSection ?? null,
      difficulty: slot.difficulty,
      count: topic ? SCHOOL_SET_SIZE : section?.setSize ?? SCHOOL_SET_SIZE,
      weakSkills: [],
      avoidPrompts: (priorQs ?? []).map((q) => q.prompt),
      language: topic?.language ?? "en",
      interests: plan.profile.interests,
      themeName: themeById(plan.profile.theme).name,
      learner: learnerPromptLine(plan.profile.learner_profile),
    });
  } catch (err) {
    return { made: null, remaining: plan.missing.length, error: err instanceof Error ? err.message : "Could not generate the quiz." };
  }

  const { data: quiz, error } = await admin
    .from("quizzes")
    .insert({
      student_id: studentId,
      topic_id: topic?.id ?? null,
      track,
      act_section: slot.actSection ?? null,
      title: generated.title,
      passage: generated.passage,
      difficulty: slot.difficulty,
      scheduled_for: slot.date,
      plan_slot: slot.slot,
      language: topic?.language ?? "en",
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    // Another Prepare loop (a second tab, or the nightly cron) wrote this slot first; move on to the next one.
    return { made: null, remaining: Math.max(0, plan.missing.length - 1) };
  }
  if (error || !quiz) return { made: null, remaining: plan.missing.length, error: error?.message ?? "Could not save the quiz." };
  const { data: rows, error: qErr } = await admin
    .from("quiz_questions")
    .insert(generated.questions.map((q, i) => ({ quiz_id: quiz.id, position: i + 1, prompt: q.prompt, choices: q.choices, skill_tag: q.skill_tag })))
    .select("id, position");
  if (qErr || !rows) {
    await admin.from("quizzes").delete().eq("id", quiz.id);
    return { made: null, remaining: plan.missing.length, error: qErr?.message ?? "Could not save the questions." };
  }
  await admin.from("quiz_answer_keys").insert(
    rows.map((row) => {
      const src = generated.questions[row.position - 1];
      return { question_id: row.id, correct_index: src.correct_index, explanation: src.explanation };
    }),
  );
  return { made: generated.title, remaining: plan.missing.length - 1 };
}
