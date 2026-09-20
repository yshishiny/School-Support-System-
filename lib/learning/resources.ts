/**
 * "This week" material: which topics the child is on right now (class log + planned quizzes), and
 * getting each one ready ahead of time: a lesson, two or three diagrams and video lessons from several
 * channels. Everything is cached per topic and grade, so the child never waits for the AI when the
 * nightly job ran; when it did not, the pieces are produced in parallel.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { explainTopic } from "@/lib/ai/explain-topic";
import { reviewLesson } from "@/lib/teaching/review";
import { report } from "@/lib/ops/fault";
import { drawTopicVisuals } from "@/lib/ai/topic-visuals";
import { findVideos, type VideoLesson } from "@/lib/videos";
import { shiftDate, todayIn } from "@/lib/dates";
import type { Topic } from "@/lib/types";
import type { Level } from "@/lib/levels";

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
    admin.from("lessons").select("topic_id, grade").eq("level", "basics").in("topic_id", ids),
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

/**
 * Lesson text for one topic at one depth (idempotent). The two depths are cached separately.
 *
 * Between writing it and storing it there is now a discernment pass. A lesson that fails a blocking check is not
 * stored, which means it is never served: the cache only ever holds lessons that were checked and released. One
 * that passes but carries a warning is stored with the warning on it, for a parent to see.
 */
export async function ensureLesson(t: Topic, grade: number | null, learner: string | null, level: Level = "basics"): Promise<{ status: "made" | "exists" | "held"; excerpt: string | null; failed?: string[] }> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("lessons").select("content_md").eq("topic_id", t.id).eq("level", level).filter("grade", grade === null ? "is" : "eq", grade).maybeSingle();
  if (existing) return { status: "exists", excerpt: existing.content_md.slice(0, 1500) };
  // Anything a parent has sent back on this topic, newest first: the model is told before it writes, not after.
  const { data: sentBack } = await admin
    .from("lesson_rejections").select("reason").eq("topic_id", t.id).eq("level", level)
    .order("created_at", { ascending: false }).limit(3);
  const corrections = ((sentBack ?? []) as { reason: string }[]).map((r) => r.reason);

  const { content, model } = await explainTopic({ grade, subject: t.subject, unit: t.unit, topic: t.name, track: t.track, language: t.language, learner, level, corrections });

  const review = await reviewLesson(
    {
      id: t.id, curriculumId: (t as Topic & { curriculum_id?: string | null }).curriculum_id ?? "school",
      grade: grade ?? t.grade ?? 0, stream: (t as Topic & { stream?: string | null }).stream ?? null,
      subject: t.subject, unit: t.unit, name: t.name, language: t.language,
    },
    level,
    content,
  );
  if (!review.release) {
    // Held, not stored. The next attempt writes a fresh lesson rather than serving this one, and the reference
    // says which checks stopped it.
    const ref = await report("learning.lessonHeld", new Error(`Lesson held: ${review.blocking.join(", ")}`), {
      meta: { topicId: t.id, topic: t.name, level, blocking: review.blocking, results: review.results },
    });
    return { status: "held", excerpt: null, failed: [...review.blocking, `ref:${ref}`] };
  }

  await admin.from("lessons").upsert({
    topic_id: t.id, grade, level, content_md: content, model,
    checked_at: new Date().toISOString(), failed_checks: review.warnings, review_model: review.model,
  }, { onConflict: "topic_id,grade,level" });
  return { status: "made", excerpt: content.slice(0, 1500), failed: review.warnings };
}

/**
 * Lesson, diagrams and videos for one topic, the lesson and the diagrams in parallel.
 *
 * A held lesson is reported rather than hidden: the caller needs to know the topic is still not ready, or the
 * nightly job will count it as done and never come back to it.
 */
export async function ensureTopicMaterial(t: Topic, grade: number | null, learner: string | null, level: Level = "basics"): Promise<{ lesson: "made" | "exists" | "held"; resources: "made" | "exists"; failed?: string[] }> {
  const [lesson, resources] = await Promise.all([ensureLesson(t, grade, learner, level), ensureTopicResources(t, grade, null)]);
  return { lesson: lesson.status, resources, failed: lesson.failed };
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
      const made = await ensureTopicMaterial(w.topic, w.grade, learner);
      if (made.lesson === "held") {
        // Not prepared, and not an error either: it will be attempted again tomorrow with a fresh lesson.
        errors.push(`${w.topic.name}: held (${(made.failed ?? []).join(", ")})`);
        continue;
      }
      prepared += 1;
    } catch (err) {
      errors.push(`${w.topic.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { prepared, remaining: Math.max(0, todo.length - prepared - errors.length), errors };
}
