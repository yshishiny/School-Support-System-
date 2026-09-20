import { report } from "@/lib/ops/fault";
import { createAdminClient } from "@/lib/supabase/admin";
import { characterById } from "@/lib/characters";
import { generateLessonScript, SCRIPT_VERSION, VISUALS_VERSION } from "@/lib/ai/lesson-script";
import { learnerPromptLine } from "@/lib/learner";
import { shiftDate } from "@/lib/dates";
import { enrichBeats } from "./enrich";
import type { Profile, Topic } from "@/lib/types";

/**
 * Writing a lesson takes the better part of a minute, and drawing it takes longer. A child who taps a topic
 * should not pay for either. Overnight, the topics his class actually covered this week are written and
 * illustrated in advance, so by morning the common ones open at once.
 *
 * Only topics already logged in a real class are warmed: guessing the whole curriculum would cost money on
 * lessons nobody opens.
 */
export async function warmLessonScripts(studentId: string, budgetMs: number): Promise<string[]> {
  const started = Date.now();
  const done: string[] = [];
  if (!process.env.ANTHROPIC_API_KEY) return done;
  const admin = createAdminClient();

  const { data: row } = await admin.from("profiles").select("*").eq("id", studentId).maybeSingle();
  if (!row) return done;
  const profile = row as Profile;
  const character = characterById(profile.character_id);

  // What the class actually did in the last fortnight, most recent first.
  const { data: logs } = await admin
    .from("lesson_logs")
    .select("topic_id, log_date")
    .eq("student_id", studentId)
    .not("topic_id", "is", null)
    .gte("log_date", shiftDate(new Date().toISOString().slice(0, 10), -14))
    .order("log_date", { ascending: false });
  const topicIds = [...new Set(((logs ?? []) as { topic_id: string }[]).map((l) => l.topic_id))];
  if (topicIds.length === 0) return done;

  const { data: topicRows } = await admin.from("topics").select("*").in("id", topicIds);
  const topics = (topicRows ?? []) as Topic[];

  // Skip anything already written at the current version for this child's character and language.
  const { data: cached } = await admin
    .from("lesson_scripts")
    .select("topic_id")
    .in("topic_id", topicIds)
    .eq("character_id", character.id)
    .is("flagged_at", null)
    .gte("version", SCRIPT_VERSION);
  const have = new Set(((cached ?? []) as { topic_id: string | null }[]).map((c) => c.topic_id));

  for (const id of topicIds) {
    if (Date.now() - started > budgetMs) break;
    if (have.has(id)) continue;
    const topic = topics.find((t) => t.id === id);
    if (!topic) continue;
    const language = (topic.language === "ar" ? "ar" : "en") as "en" | "ar";
    try {
      const script = await generateLessonScript({
        subject: topic.subject,
        unit: topic.unit ?? null,
        topic: topic.name,
        grade: topic.grade ?? profile.grade,
        language,
        character,
        sourceText: null,
        learner: learnerPromptLine(profile.learner_profile),
        interests: profile.interests,
      });
      const { model, ...body } = script;
      const beats = await enrichBeats(body.beats, { subject: topic.subject, topic: topic.name, language }).catch(() => body.beats);
      const { error } = await admin.from("lesson_scripts").insert({
        topic_id: topic.id,
        material_id: null,
        character_id: character.id,
        language,
        grade: topic.grade ?? profile.grade,
        title: body.title,
        minutes: body.minutes,
        script: { beats, quiz: body.quiz },
        model,
        version: SCRIPT_VERSION,
        visuals_version: VISUALS_VERSION,
      });
      if (!error) done.push(topic.name);
    } catch (err) {
      // One topic that will not write must not stop the rest of the night, but it is not a secret either.
      await report("teach.warmLesson", err, { userId: studentId, meta: { topic: topic.name, topicId: topic.id } });
    }
  }
  return done;
}

/**
 * A lesson opens before its pictures are drawn, and the drawing runs in the background. When that background
 * work dies with its instance, the lesson is left marked "being drawn" and nothing ever picks it up again.
 * Anything claimed longer ago than a drawing can plausibly take is handed back to be retried.
 */
export async function releaseStuckVisuals(): Promise<number> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 20 * 60_000).toISOString();
  const { data } = await admin
    .from("lesson_scripts")
    .update({ visuals_version: null })
    .eq("visuals_version", 0)
    .or(`visuals_started_at.is.null,visuals_started_at.lt.${cutoff}`)
    .select("id");
  return data?.length ?? 0;
}
