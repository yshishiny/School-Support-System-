import { NextResponse } from "next/server";
import { recordCronRun } from "@/lib/ops/log";
import { sendDueNudges } from "@/lib/nudges/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Kid reminders. Run hourly: on Vercel Pro add { "path": "/api/cron/nudges", "schedule": "0 * * * *" } to vercel.json;
 * on Hobby (daily crons only) point a free external scheduler (e.g. cron-job.org) at this URL every hour with
 * the header  Authorization: Bearer <CRON_SECRET>.  Each nudge is sent at most once a day, so extra runs are harmless.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  try {
    const results = await sendDueNudges();
    console.log("[nudges] results", JSON.stringify(results));
    await recordCronRun("nudges", started, results as Record<string, unknown>);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    await recordCronRun("nudges", started, {}, err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
