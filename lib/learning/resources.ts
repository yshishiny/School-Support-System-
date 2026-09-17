/**
 * "This week" material: which topics the child is on right now (class log + planned quizzes), and
 * getting each one ready ahead of time: a lesson, two or three diagrams and video lessons from several
 * channels. Everything is cached per topic and grade, so the child never waits for the AI when the
 * nightly job ran; when it did not, the pieces are produced in parallel.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { explainTopic } from "@/lib/ai/explain-topic";
import { drawTopicVisuals } from "@/lib/ai/topic-visuals";
import { findVideos, type VideoLesson } from "@/lib/videos";
import { shiftDate, todayIn } from "@/lib/dates";
import type { Topic } from "@/lib/types";

export interface Visual { title: string; caption: string; svg: string }
export interface TopicResources { visuals: Visual[]; videos: VideoLesson[]; model: string | null; updated_at: string }

export interface WeekTopic {
  topic: Topic;
  grade: number | null;
  when: string;            // date it was logged or is planned for
  why: "logged" | "planned";
  hasLesson: boolean;
  hasResources: boolean;
}

export function gradeKey(t: Topic, studentGrade: number | null): number | null {
  return t.track === "school" ? (t.grade ?? studentGrade) : null;
}

/** Topics the child logged in class in the last 7 days, plus the ones planned in the next 7. */
export async function weekTopicsFor(studentId: string, studentGrade: number | null, timezone: string): Promise<WeekTopic[]> {
  const admin = createAdminClient();
  const today = todayIn(timezone);
  const [{ data: logs }, { data: planned }] = await Promise.all([
    admin.from("lesson_logs").select("topic_id, log_date").eq("student_id", studentId).not("topic_id", "is", null).gte("log_date", shiftDate(today, -6)).lte("log_date", today).order("log_date", { ascending: false }),
    admin.from("quizzes").select("topic_id, scheduled_for").eq("student_id", studentId).not("topic_id", "is", null).not("scheduled_for", "is", null).gte("scheduled_for", shiftDate(today, -1)).lte("scheduled_for", shiftDate(today, 6)).order("scheduled_for"),
  ]);
  const seen = new Map<string, { when: string; why: "logged" | "planned" }>();
  for (const l of logs ?? []) if (l.topic_id && !seen.has(l.topic_id)) seen.set(l.topic_id, { when: l.log_date, why: "logged" });
  for (const q of planned ?? []) if (q.topic_id && !seen.has(q.topic_id)) seen.set(q.topic_id, { when: q.scheduled_for!, why: "planned" });
  if (seen.size === 0) return [];
  const ids = [...seen.keys()];
  const { data: topicRows } = await admin.from("topics").select("*").in("id", ids);
  const topics = (topicRows ?? []) as Topic[];
  const [{ data: lessons }, { data: resources }] = await Promise.all([
    admin.from("lessons").select("topic_id, grade").in("topic_id", ids),
    admin.from("topic_resources").select("topic_id, grade").in("topic_id", ids),
  ]);
  const has = (rows: { topic_id: string; grade: number | null }[] | null, t: Topic) => (rows ?? []).some((r) => r.topic_id === t.id && (r.grade ?? null) === gradeKey(t, studentGrade));
  return topics
    .map((t) => ({ topic: t, grade: gradeKey(t, studentGrade), when: seen.get(t.id)!.when, why: seen.get(t.id)!.why, hasLesson: has(lessons, t), hasResources: has(resources, t) }))
    .sort((a, b) => (a.why === b.why ? (a.why === "logged" ? b.when.localeCompare(a.when) : a.when.localeCompare(b.when)) : a.why === "logged" ? -1 : 1));
}

export async function loadTopicResources(topicId: string, grade: number | null): Promise<TopicResources | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("topic_resources").select("visuals, videos, model, updated_at").eq("topic_id", topicId).filter("grade", grade === null ? "is" : "eq", grade).maybeSingle();
  if (!data) return null;
  return { visuals: (data.visuals ?? []) as Visual[], videos: (data.videos ?? []) as VideoLesson[], model: data.model, updated_at: data.updated_at };
}

/** Diagrams and videos for one topic (idempotent). Runs the drawing and the video search side by side. */
export async function ensureTopicResources(t: Topic, grade: number | null, lessonExcerpt?: string | null): Promise<"made" | "exists"> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("topic_resources").select("id").eq("topic_id", t.id).filter("grade", grade === null ? "is" : "eq", grade).maybeSingle();
  if (existing) return "exists";
  const drawn = await drawTopicVisuals({ subject: t.subject, unit: t.unit, topic: t.name, grade, language: t.language, lessonExcerpt });
  const videos = await findVideos(drawn.videoQuery || `${t.subject} ${t.name}`, t.language, t.subject);
  await admin.from("topic_resources").upsert({ topic_id: t.id, grade, visuals: drawn.visuals, videos, model: drawn.model, updated_at: new Date().toISOString() }, { onConflict: "topic_id,grade" });
  return "made";
}

/** Lesson text for one topic (idempotent). */
export async function ensureLesson(t: Topic, grade: number | null, learner: string | null): Promise<{ status: "made" | "exists"; excerpt: string | null }> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("lessons").select("content_md").eq("topic_id", t.id).filter("grade", grade === null ? "is" : "eq", grade).maybeSingle();
  if (existing) return { status: "exists", excerpt: existing.content_md.slice(0, 1500) };
  const { content, model } = await explainTopic({ grade, subject: t.subject, unit: t.unit, topic: t.name, track: t.track, language: t.language, learner });
  await admin.from("lessons").upsert({ topic_id: t.id, grade, content_md: content, model }, { onConflict: "topic_id,grade" });
  return { status: "made", excerpt: content.slice(0, 1500) };
}

/** Lesson, diagrams and videos for one topic, the lesson and the diagrams in parallel. */
export async function ensureTopicMaterial(t: Topic, grade: number | null, learner: string | null): Promise<{ lesson: "made" | "exists"; resources: "made" | "exists" }> {
  const [lesson, resources] = await Promise.all([ensureLesson(t, grade, learner), ensureTopicResources(t, grade, null)]);
  return { lesson: lesson.status, resources };
}

/** Gets this week's topics ready for one student, a few at a time, within a time budget. */
export async function prepareWeekMaterial(studentId: string, opts: { limit?: number; budgetMs?: number } = {}): Promise<{ prepared: number; remaining: number; errors: string[] }> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("grade, learner_profile, families(timezone)").eq("id", studentId).single();
  if (!profile) return { prepared: 0, remaining: 0, errors: ["no profile"] };
  const fam = profile.families as unknown as { timezone: string } | null;
  const { learnerPromptLine } = await import("@/lib/learner");
  const learner = learnerPromptLine(profile.learner_profile);
  const started = Date.now();
  const limit = opts.limit ?? 4;
  const budget = opts.budgetMs ?? 200_000;
  const week = await weekTopicsFor(studentId, profile.grade, fam?.timezone ?? "Africa/Cairo");
  const todo = week.filter((w) => !w.hasLesson || !w.hasResources);
  let prepared = 0;
  const errors: string[] = [];
  for (const w of todo) {
    if (prepared >= limit || Date.now() - started > budget) break;
    try {
      await ensureTopicMaterial(w.topic, w.grade, learner);
      prepared += 1;
    } catch (err) {
      errors.push(`${w.topic.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { prepared, remaining: Math.max(0, todo.length - prepared - errors.length), errors };
}
