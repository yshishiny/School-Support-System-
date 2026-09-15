import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prepareNextPlannedQuiz } from "@/lib/plan/prepare";
import { coachReportStale, generateCoachReport } from "@/lib/coach/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIME_BUDGET_MS = 230_000; // leave headroom under maxDuration for the last generation to finish

/** Called nightly by Vercel Cron: fills any missing quizzes in every student's 7-day plan, a few per run. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const admin = createAdminClient();
  const { data: students } = await admin.from("profiles").select("id, full_name").eq("role", "student");
  const results: Record<string, string[]> = {};
  const pending = new Set((students ?? []).map((s) => s.id));
  // Round-robin so both kids get quizzes even when the budget runs out.
  while (pending.size && Date.now() - started < TIME_BUDGET_MS) {
    for (const id of [...pending]) {
      if (Date.now() - started >= TIME_BUDGET_MS) break;
      try {
        const r = await prepareNextPlannedQuiz(id);
        (results[id] ??= []).push(r.error ? `error: ${r.error}` : r.made ? `made: ${r.made} (${r.remaining} left)` : "complete");
        if (r.error || r.remaining === 0) pending.delete(id);
      } catch (err) {
        (results[id] ??= []).push(`error: ${err instanceof Error ? err.message : String(err)}`);
        pending.delete(id);
      }
    }
  }
  // Weekly coach analysis per student, when time remains.
  for (const s of students ?? []) {
    if (Date.now() - started >= TIME_BUDGET_MS) break;
    try {
      if (await coachReportStale(s.id)) {
        const r = await generateCoachReport(s.id);
        (results[s.id] ??= []).push(`coach: ${r.headline}`);
      }
    } catch (err) {
      (results[s.id] ??= []).push(`coach error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log("[prepare-plan] cron results", JSON.stringify(results));
  return NextResponse.json({ ok: true, seconds: Math.round((Date.now() - started) / 1000), results });
}
