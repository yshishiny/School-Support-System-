import { masteryFor } from "@/lib/learning";
import type { Attempt } from "@/lib/types";

export interface AttemptWithQuiz extends Attempt {
  quizzes: { topic_id: string | null; act_section: string | null; track: string; title: string } | null;
}

/** Mastery per topic id and per ACT section from a student's submitted attempts. */
export function masteryMaps(attempts: AttemptWithQuiz[]) {
  const byTopic = new Map<string, { score: number; total: number; submitted_at: string }[]>();
  const bySection = new Map<string, { score: number; total: number; submitted_at: string }[]>();
  for (const a of attempts) {
    if (!a.submitted_at || a.total === null || a.score === null || a.flagged) continue;
    const row = { score: a.score, total: a.total, submitted_at: a.submitted_at };
    if (a.quizzes?.topic_id) byTopic.set(a.quizzes.topic_id, [...(byTopic.get(a.quizzes.topic_id) ?? []), row]);
    if (a.quizzes?.act_section) bySection.set(a.quizzes.act_section, [...(bySection.get(a.quizzes.act_section) ?? []), row]);
  }
  const topic = new Map<string, number>();
  byTopic.forEach((rows, id) => topic.set(id, masteryFor(rows) ?? 0));
  const section = new Map<string, number>();
  bySection.forEach((rows, id) => section.set(id, masteryFor(rows) ?? 0));
  return { topic, section };
}

export function masteryColor(m: number | undefined): string {
  if (m === undefined) return "bg-panel-2";
  if (m >= 80) return "bg-good";
  if (m >= 50) return "bg-warn";
  return "bg-bad";
}
