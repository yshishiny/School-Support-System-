/**
 * Operations log. Every caught failure goes through logError: it is stored, and the administrator gets one inbox
 * note per area per hour (not one per failure). Never throws, so logging can never make a failure worse.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { addToInbox } from "@/lib/inbox";
import { APP_VERSION } from "@/lib/version";
import { who } from "./who";

export interface ErrorContext { familyId?: string | null; userId?: string | null; ref?: string | null; meta?: Record<string, unknown> }

/** Which deployment reported it: the two sites (main = live, v2 = beta) share this log. */
export function siteTag(): { site: string; version: string } {
  return { site: process.env.VERCEL_GIT_COMMIT_REF ?? (process.env.VERCEL ? "vercel" : "local"), version: APP_VERSION };
}

export async function logError(area: string, err: unknown, ctx: ErrorContext = {}): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack ?? null : null;
  // Who was on the phone, unless the caller knows better. Most failures used to be logged against nobody.
  const seen = who();
  const userId = ctx.userId ?? seen?.userId ?? null;
  const familyId = ctx.familyId ?? seen?.familyId ?? null;
  console.error(`[${area}]${ctx.ref ? ` ref=${ctx.ref}` : ""}`, message);
  try {
    const admin = createAdminClient();
    await admin.from("app_errors").insert({ area, ref: ctx.ref ?? null, message: message.slice(0, 2000), stack: stack?.slice(0, 6000) ?? null, meta: { ...siteTag(), ...(ctx.meta ?? {}) }, family_id: familyId, user_id: userId });
    // Tell the administrator, at most once an hour per area.
    const { data: admins } = await admin.from("profiles").select("id, family_id").eq("is_admin", true);
    if (!admins?.length) return;
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("app_errors").select("id", { count: "exact", head: true }).eq("area", area).gte("created_at", since);
    if ((count ?? 0) > 1) return;
    await Promise.all(admins.map((a) => addToInbox(a.family_id, a.id, { kind: "info", title: `⚠️ System error in ${area}`, body: `${message.slice(0, 300)}\nMore on the Admin page.`, url: "/parent/admin?tab=errors" })));
  } catch (e) {
    console.error("[ops] could not store error", e instanceof Error ? e.message : e);
  }
}

/** Stores one cron run with its results; failures inside the run are logged as errors too. */
export async function recordCronRun(job: string, startedAt: number, results: Record<string, unknown>, error?: unknown): Promise<void> {
  try {
    const admin = createAdminClient();
    const text = JSON.stringify(results);
    const failing = /error/i.test(text);
    await admin.from("cron_runs").insert({ job, started_at: new Date(startedAt).toISOString(), seconds: Math.round((Date.now() - startedAt) / 1000), ok: !error && !failing, results, error: error ? (error instanceof Error ? error.message : String(error)) : null });
    if (error) await logError(`cron.${job}`, error);
    else if (failing) await logError(`cron.${job}`, new Error("Some steps reported errors"), { meta: { results } });
  } catch (e) {
    console.error("[ops] could not record cron run", e instanceof Error ? e.message : e);
  }
}
