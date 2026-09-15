import { createAdminClient } from "@/lib/supabase/admin";
import { collectCoachStats } from "./analyze";
import { runCoach } from "@/lib/ai/coach";
import { themeById } from "@/lib/themes";
import type { CoachReport } from "@/lib/types";

/** Analyses one student and stores the report. Used by the parent button and the nightly cron. */
export async function generateCoachReport(studentId: string): Promise<CoachReport> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
  const stats = await collectCoachStats(studentId);
  stats.themeName = themeById(stats.student.theme).name;
  const out = await runCoach(stats);
  const levels: Record<string, "easy" | "medium" | "hard"> = {};
  const known = new Set(stats.subjects.map((s) => s.subject));
  for (const l of out.levels) if (known.has(l.subject)) levels[l.subject] = l.level;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coach_reports")
    .insert({
      student_id: studentId,
      family_id: stats.student.family_id,
      period_start: stats.periodStart,
      period_end: stats.today,
      headline: out.headline,
      parent_md: out.parent_md,
      kid_md: out.kid_md,
      data: {
        subjects: stats.subjects.map((s) => ({ subject: s.subject, sets: s.sets, pct: s.pct, trend: s.trend, weakest: s.weakest, strongest: s.strongest })),
        focus: out.focus,
        accelerate: out.accelerate,
      },
      levels,
      model: out.model,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the coach report.");
  return data as CoachReport;
}

/** True when the student has no report, or the latest one is older than `days`. */
export async function coachReportStale(studentId: string, days = 7): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("coach_reports").select("created_at").eq("student_id", studentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return true;
  return Date.now() - new Date(data.created_at).getTime() > days * 86400000;
}
