import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/dates";

/**
 * Opening an attempt, for the pages that render one.
 *
 * Server helpers, not actions. They establish the student themselves and only ever read and write that student's
 * own rows; the reason they moved out of `lib/actions/learning.ts` is that every export of a `"use server"` module
 * is a callable endpoint, and neither of these was ever meant to be one.
 */

/** Ensures there is one open attempt for this quiz and returns its id. */
export async function ensureAttempt(quizId: string): Promise<string> {
  const { profile } = await requireStudent();
  const admin = createAdminClient();
  const { data: open } = await admin.from("attempts").select("id").eq("student_id", profile.id).eq("quiz_id", quizId).is("submitted_at", null).maybeSingle();
  if (open) return open.id;
  const { data } = await admin.from("attempts").insert({ student_id: profile.id, quiz_id: quizId, kind: "quiz" }).select("id").single();
  return data!.id;
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
