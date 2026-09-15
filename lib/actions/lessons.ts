"use server";

import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { guessLesson, type LessonGuess } from "@/lib/ai/guess-lesson";
import { curriculumSubject } from "@/lib/plan";
import { shiftDate, todayIn } from "@/lib/dates";
import type { Topic } from "@/lib/types";

/** The kid types a vague hint about a class; Claude guesses the lesson from the curriculum and recent notes. */
export async function guessLessonAction(subject: string, hint: string): Promise<LessonGuess | { error: string }> {
  const { profile, family } = await requireStudent();
  const clean = hint.trim().slice(0, 200);
  if (clean.length < 2) return { error: "Give me a small hint first, even one word." };
  if (!process.env.ANTHROPIC_API_KEY) return { error: "The helper is not configured on the server." };
  const admin = createAdminClient();
  const today = todayIn(family.timezone);
  const { data: topics } = await admin.from("topics").select("*").eq("track", "school").eq("grade", profile.grade ?? 0).order("subject").order("sort");
  const all = (topics ?? []) as Topic[];
  const mapped = curriculumSubject(subject, [...new Set(all.map((t) => t.subject))]);
  const list = all.filter((t) => t.subject === mapped);
  const { data: logs } = await admin
    .from("lesson_logs")
    .select("note, log_date")
    .eq("student_id", profile.id)
    .eq("subject_name", subject)
    .gte("log_date", shiftDate(today, -30))
    .order("log_date")
    .limit(8);
  try {
    return await guessLesson({
      grade: profile.grade,
      subject: mapped ?? subject,
      hint: clean,
      topics: list.map((t) => ({ id: t.id, name: t.name, unit: t.unit })),
      recent: (logs ?? []).map((l) => l.note),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The helper did not answer." };
  }
}
