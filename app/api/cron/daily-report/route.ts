import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndSendReport } from "@/lib/reports/generate";
import { hourIn } from "@/lib/dates";
import { sendDueNudges } from "@/lib/nudges/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called by Vercel Cron (see vercel.json). Sends today's report to every family whose report hour has passed. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // The beta site shares the live database: its crons stay off (CRON_DISABLED=1) so nothing runs twice.
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, skipped: "crons disabled on this deployment" });
  const admin = createAdminClient();
  const { data: families } = await admin.from("families").select("id, timezone, report_hour");
  const results: Record<string, unknown> = {};
  // Kids' evening reminder rides on this cron so it works without an hourly scheduler.
  try {
    const n = await sendDueNudges(["evening", "catchup"]);
    if (Object.keys(n).length) results.nudges = n;
  } catch (err) {
    results.nudges = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
  for (const f of families ?? []) {
    if (hourIn(f.timezone) < f.report_hour) {
      results[f.id] = "not yet";
      continue;
    }
    try {
      const r = await generateAndSendReport(f.id);
      results[f.id] = r.skipped ? "already sent" : r.sent ? `sent via ${r.channel}` : `stored (${r.error})`;
    } catch (err) {
      results[f.id] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  console.log("[daily-report] cron results", JSON.stringify(results));
  return NextResponse.json({ ok: true, results });
}
