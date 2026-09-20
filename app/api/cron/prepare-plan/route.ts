import { NextResponse } from "next/server";
import { recordCronRun } from "@/lib/ops/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { prepareNextPlannedQuiz } from "@/lib/plan/prepare";
import { coachReportStale, generateCoachReport } from "@/lib/coach/run";
import { snapshotAttention } from "@/lib/coach/signals-run";
import { closeAllowanceWeek } from "@/lib/allowance/week";
import { notifyParents } from "@/lib/notify";
import { checkDueSources } from "@/lib/sources/check";
import { loadSnapTasks, pruneOldSnaps } from "@/lib/snaps/server";
import { retryFailedMaterials } from "@/lib/actions/materials";
import { runWeeklyCheckpoints } from "@/lib/checkpoint/build";
import { prepareWeekMaterial } from "@/lib/learning/resources";
import { releaseStuckVisuals, warmLessonScripts } from "@/lib/teach/warm";
import { warnAboutExpiringAccess } from "@/lib/access/expiry";
import { buildMonthlyRevisions } from "@/lib/revision/run";
import { todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIME_BUDGET_MS = 230_000; // leave headroom under maxDuration for the last generation to finish

type Admin = ReturnType<typeof createAdminClient>;

/**
 * The virtual teacher's overnight work: hand back anything left half-drawn when a background job died with its
 * instance, then write and illustrate the topics each class actually covered, so tapping a topic in the morning
 * opens it at once instead of waiting a minute for the AI.
 */
async function prepareTeacherLessons(admin: Admin, started: number, results: Record<string, string[]>): Promise<void> {
  // Before anything else: tell a parent whose month is about to end, while there is still time to renew.
  const warned = await warnAboutExpiringAccess();
  if (warned.length) results.access = warned;
  try {
    const n = await releaseStuckVisuals();
    if (n) results.visuals = [`released ${n} stuck`];
  } catch (err) {
    results.visuals = [`release error: ${err instanceof Error ? err.message : String(err)}`];
  }
  const { data: students } = await admin.from("profiles").select("id").eq("role", "student");
  for (const s of students ?? []) {
    if (Date.now() - started >= TIME_BUDGET_MS) break;
    try {
      const names = await warmLessonScripts(s.id, Math.max(0, TIME_BUDGET_MS - (Date.now() - started)));
      if (names.length) (results[s.id] ??= []).push(`lessons written: ${names.join("; ")}`);
    } catch (err) {
      (results[s.id] ??= []).push(`lesson warm error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/** Called nightly by Vercel Cron: fills any missing quizzes in every student's 7-day plan, a few per run. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const admin = createAdminClient();
  // The beta shares the live database, so everything below that writes shared tables stays off here
  // (CRON_DISABLED=1) and runs on the live site only — otherwise both would do it and pay twice.
  //
  // The virtual teacher is the exception. Its lessons live in tables the live site's code never touches, so
  // there is nothing for it to collide with, and the live site cannot prepare them because it does not have
  // the teacher at all. Without this the overnight lesson writing would simply never run anywhere.
  if (process.env.CRON_DISABLED === "1") {
    const betaResults: Record<string, string[]> = {};
    await prepareTeacherLessons(admin, started, betaResults);
    console.log("[prepare-plan] beta-only results", JSON.stringify(betaResults));
    await recordCronRun("prepare-plan-beta", started, betaResults);
    return NextResponse.json({ ok: true, betaOnly: true, seconds: Math.round((Date.now() - started) / 1000), results: betaResults });
  }
  const { data: students } = await admin.from("profiles").select("id, full_name, family_id").eq("role", "student");
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
  // This week's lessons, diagrams and videos, so the child never waits for the AI (a few topics per night).
  for (const s of students ?? []) {
    if (Date.now() - started >= TIME_BUDGET_MS) break;
    try {
      const r = await prepareWeekMaterial(s.id, { limit: 4, budgetMs: Math.max(0, TIME_BUDGET_MS - (Date.now() - started)) });
      if (r.prepared || r.errors.length) (results[s.id] ??= []).push(`week material: ${r.prepared} ready, ${r.remaining} left${r.errors.length ? `, errors: ${r.errors.join("; ")}` : ""}`);
    } catch (err) {
      (results[s.id] ??= []).push(`week material error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // Allowance: close last week the morning after pay day and tell the parent.
  const { data: fams } = await admin.from("families").select("id, timezone, allowance_enabled, allowance_amount, allowance_pay_weekday, allowance_kpis").eq("allowance_enabled", true);
  for (const f of fams ?? []) {
    const lines: string[] = [];
    for (const s of (students ?? []).filter((x) => x.family_id === f.id)) {
      try {
        const w = await closeAllowanceWeek(s.id, f);
        if (w) lines.push(`${s.full_name.split(" ")[0]}: score ${w.score}/100 → ${w.amount} EGP`);
      } catch (err) {
        (results[s.id] ??= []).push(`allowance error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (lines.length) {
      await notifyParents(f.id, `💵 *Allowance this week*\n${lines.join("\n")}\nDetails and “mark paid” are on the Allowance page.`, { kind: "allowance", url: "/parent/allowance" });
      (results[f.id] ??= []).push(`allowance closed: ${lines.join("; ")}`);
    }
  }
  // Early-warning signals: cheap, deterministic, every night.
  for (const s of students ?? []) {
    try {
      const r = await snapshotAttention(s.id, s.family_id);
      (results[s.id] ??= []).push(`signals: ${r.tier} (${r.score})`);
    } catch (err) {
      (results[s.id] ??= []).push(`signals error: ${err instanceof Error ? err.message : String(err)}`);
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
  // School websites: any source not checked in six days.
  if (Date.now() - started < TIME_BUDGET_MS) {
    try {
      const r = await checkDueSources();
      if (Object.keys(r).length) results.sources = Object.entries(r).map(([k, v]) => `${k}: ${v}`);
    } catch (err) {
      results.sources = [`error: ${err instanceof Error ? err.message : String(err)}`];
    }
  }
  // Weekly checkpoint the day before pay day (per family timezone; Cairo for now).
  if (Date.now() - started < TIME_BUDGET_MS) {
    try {
      const r = await runWeeklyCheckpoints(todayIn("Africa/Cairo"));
      if (r.length) results.checkpoints = r;
    } catch (err) {
      results.checkpoints = [`error: ${err instanceof Error ? err.message : String(err)}`];
    }
  }
  // Monthly revision sheets and quizzes from the 25th, per subject with school files this month.
  if (Date.now() - started < TIME_BUDGET_MS) {
    try {
      const r = await buildMonthlyRevisions(todayIn("Africa/Cairo"), { budgetMs: Math.max(0, TIME_BUDGET_MS - (Date.now() - started)) });
      if (r.length) results.revision = r;
    } catch (err) {
      results.revision = [`error: ${err instanceof Error ? err.message : String(err)}`];
    }
  }
  // School files that failed to read for a temporary reason: try again.
  if (Date.now() - started < TIME_BUDGET_MS) {
    try {
      const r = await retryFailedMaterials();
      if (r.length) results.materials = r;
    } catch (err) {
      results.materials = [`retry error: ${err instanceof Error ? err.message : String(err)}`];
    }
  }
  // Shared chores: hand the turn to the next child when a turn ends, so every version of the app sees the same owner.
  try {
    const { data: fams } = await admin.from("families").select("id, timezone");
    for (const f of fams ?? []) await loadSnapTasks(f.id as string, (f.timezone as string) ?? "Africa/Cairo");
    results.rota = ["synced"];
  } catch (err) {
    results.rota = [`rota error: ${err instanceof Error ? err.message : String(err)}`];
  }
  // Snap pictures: 30-day retention (handwriting samples a year).
  try {
    const n = await pruneOldSnaps();
    if (n) results.snaps = [`pruned ${n}`];
  } catch (err) {
    results.snaps = [`prune error: ${err instanceof Error ? err.message : String(err)}`];
  }
  await prepareTeacherLessons(admin, started, results);
  console.log("[prepare-plan] cron results", JSON.stringify(results));
  await recordCronRun("prepare-plan", started, results);
  return NextResponse.json({ ok: true, seconds: Math.round((Date.now() - started) / 1000), results });
}
