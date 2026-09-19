/** Health checks for the Admin page: configuration, database, jobs, external services. Every check is a plain row. */
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_VERSION, buildId } from "@/lib/version";
import { aiTier } from "@/lib/ai/models";

export type Tone = "good" | "warn" | "bad" | "muted";
export interface Check { name: string; tone: Tone; value: string; detail?: string; url?: string }

const has = (k: string) => !!process.env[k];

export async function configChecks(): Promise<Check[]> {
  return [
    { name: "App version", tone: "muted", value: `${APP_VERSION} · build ${buildId()}` },
    { name: "Anthropic API key", tone: has("ANTHROPIC_API_KEY") ? "good" : "bad", value: has("ANTHROPIC_API_KEY") ? `set · tier ${aiTier()}` : "missing" },
    // The beta shares the live database and keeps its own jobs off on purpose, so a missing secret there is the
    // intended state, not a fault: the live site runs the nightly work for both.
    process.env.CRON_DISABLED === "1"
      ? { name: "Cron secret", tone: "good" as const, value: "not needed: this site's jobs are off, the live site runs them" }
      : { name: "Cron secret", tone: has("CRON_SECRET") ? ("good" as const) : ("bad" as const), value: has("CRON_SECRET") ? "set" : "missing: nightly jobs refused" },
    { name: "Telegram bot", tone: has("TELEGRAM_BOT_TOKEN") ? "good" : "warn", value: has("TELEGRAM_BOT_TOKEN") ? "set" : "not set: reports by inbox and push only" },
    { name: "Browser push (VAPID)", tone: has("VAPID_PRIVATE_KEY") && has("NEXT_PUBLIC_VAPID_PUBLIC_KEY") ? "good" : "warn", value: has("VAPID_PRIVATE_KEY") ? "set" : "not set: no browser notifications" },
    { name: "YouTube API key", tone: has("YOUTUBE_API_KEY") ? "good" : "muted", value: has("YOUTUBE_API_KEY") ? "set: videos embed" : "not set: search links" },
    { name: "Vercel token", tone: has("VERCEL_TOKEN") ? "good" : "muted", value: has("VERCEL_TOKEN") ? "set: deployments shown below" : "not set (optional)" },
    { name: "GitHub token", tone: has("GITHUB_TOKEN") ? "good" : "muted", value: has("GITHUB_TOKEN") ? "set: commits shown below" : "not set (optional)" },
    { name: "Supabase access token", tone: has("SUPABASE_ACCESS_TOKEN") ? "good" : "muted", value: has("SUPABASE_ACCESS_TOKEN") ? "set: project status shown below" : "not set (optional)" },
  ];
}

export async function databaseChecks(): Promise<Check[]> {
  const admin = createAdminClient();
  const t0 = Date.now();
  const { error } = await admin.from("families").select("id", { count: "exact", head: true });
  const ms = Date.now() - t0;
  const out: Check[] = [{ name: "Database", tone: error ? "bad" : ms > 1500 ? "warn" : "good", value: error ? error.message : `ok · ${ms} ms` }];
  const tables = ["profiles", "families", "checkins", "lesson_logs", "prayer_logs", "quizzes", "attempts", "snaps", "materials", "lessons", "topic_resources", "allowance_weeks", "parent_notifications", "app_errors"];
  const counts = await Promise.all(tables.map(async (t) => ({ t, c: (await admin.from(t).select("id", { count: "exact", head: true })).count ?? 0 })));
  out.push({ name: "Rows", tone: "muted", value: counts.map((x) => `${x.t} ${x.c}`).join(" · ") });
  const buckets = ["snaps", "materials", "hero-images", "chat-archives"];
  for (const b of buckets) {
    const { data, error: e } = await admin.storage.from(b).list("", { limit: 1 });
    out.push({ name: `Bucket ${b}`, tone: e ? "bad" : "good", value: e ? e.message : data ? "reachable" : "empty" });
  }
  return out;
}

export interface CronRunRow { id: string; job: string; started_at: string; seconds: number; ok: boolean; results: Record<string, unknown> | null; error: string | null }

export async function jobChecks(): Promise<{ checks: Check[]; runs: CronRunRow[] }> {
  const admin = createAdminClient();
  const { data } = await admin.from("cron_runs").select("id, job, started_at, seconds, ok, results, error").order("started_at", { ascending: false }).limit(40);
  const runs = (data ?? []) as CronRunRow[];
  const jobs = [{ job: "daily-report", every: 26 }, { job: "prepare-plan", every: 26 }, { job: "nudges", every: 3 }];
  const checks: Check[] = jobs.map(({ job, every }) => {
    const last = runs.find((r) => r.job === job);
    if (!last) return { name: `Job ${job}`, tone: job === "nudges" ? "muted" : "warn", value: "never recorded", detail: job === "nudges" ? "needs an external hourly scheduler" : "runs nightly on Vercel Cron" };
    const ageH = (Date.now() - new Date(last.started_at).getTime()) / 3600_000;
    return { name: `Job ${job}`, tone: !last.ok ? "bad" : ageH > every ? "warn" : "good", value: `${last.ok ? "ok" : "with errors"} · ${Math.round(ageH)} h ago · ${last.seconds}s` };
  });
  return { checks, runs };
}

export interface ErrorRow { id: string; area: string; message: string; stack: string | null; meta: Record<string, unknown> | null; family_id: string | null; user_id: string | null; resolved_at: string | null; created_at: string; profiles?: { full_name: string } | null }

export async function recentErrors(limit = 100): Promise<ErrorRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("app_errors").select("id, area, message, stack, meta, family_id, user_id, resolved_at, created_at, profiles(full_name)").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as ErrorRow[];
}

/** Vercel: last deployments of the project (needs VERCEL_TOKEN; project from VERCEL_PROJECT_ID or the build's own). */
export async function vercelDeployments(): Promise<{ ok: boolean; note?: string; rows: { state: string; created: string; url: string; commit: string; branch: string }[] }> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return { ok: false, note: "Add VERCEL_TOKEN (Vercel → Settings → Tokens) to list deployments here.", rows: [] };
  try {
    const project = process.env.VERCEL_PROJECT_ID ?? process.env.VERCEL_PROJECT_NAME ?? "";
    const url = new URL("https://api.vercel.com/v6/deployments");
    url.searchParams.set("limit", "10");
    if (project) url.searchParams.set("projectId", project);
    if (process.env.VERCEL_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return { ok: false, note: `Vercel API returned ${res.status}`, rows: [] };
    const json = (await res.json()) as { deployments?: { state?: string; readyState?: string; created: number; url: string; meta?: Record<string, string> }[] };
    return { ok: true, rows: (json.deployments ?? []).map((d) => ({ state: d.readyState ?? d.state ?? "?", created: new Date(d.created).toISOString(), url: `https://${d.url}`, commit: d.meta?.githubCommitMessage?.slice(0, 80) ?? "", branch: d.meta?.githubCommitRef ?? "" })) };
  } catch (e) {
    return { ok: false, note: e instanceof Error ? e.message : String(e), rows: [] };
  }
}

/** GitHub: last commits on main (needs GITHUB_TOKEN for a private repo). */
export async function githubCommits(): Promise<{ ok: boolean; note?: string; rows: { sha: string; message: string; date: string; url: string }[] }> {
  const repo = process.env.GITHUB_REPO ?? "yshishiny/School-Support-System-";
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, note: "Add GITHUB_TOKEN (fine-grained, read-only on this repo) to list commits here.", rows: [] };
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=10`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return { ok: false, note: `GitHub API returned ${res.status}`, rows: [] };
    const json = (await res.json()) as { sha: string; html_url: string; commit: { message: string; author: { date: string } } }[];
    return { ok: true, rows: json.map((c) => ({ sha: c.sha.slice(0, 7), message: c.commit.message.split("\n")[0].slice(0, 100), date: c.commit.author.date, url: c.html_url })) };
  } catch (e) {
    return { ok: false, note: e instanceof Error ? e.message : String(e), rows: [] };
  }
}

/** Supabase project status via the Management API (needs SUPABASE_ACCESS_TOKEN). */
export async function supabaseStatus(): Promise<{ ok: boolean; note?: string; status?: string; region?: string; ref: string }> {
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? "unknown";
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return { ok: false, note: "Add SUPABASE_ACCESS_TOKEN (supabase.com → Account → Access Tokens) for project status.", ref };
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return { ok: false, note: `Supabase API returned ${res.status}`, ref };
    const json = (await res.json()) as { status?: string; region?: string };
    return { ok: true, status: json.status, region: json.region, ref };
  } catch (e) {
    return { ok: false, note: e instanceof Error ? e.message : String(e), ref };
  }
}

/** Google: only the YouTube Data API is used; a one-unit call tells whether the key works. */
export async function googleStatus(): Promise<Check> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { name: "Google (YouTube Data API)", tone: "muted", value: "no key: search links instead of embedded videos" };
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${key}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    return { name: "Google (YouTube Data API)", tone: res.ok ? "good" : "bad", value: res.ok ? "key works" : `returned ${res.status}` };
  } catch (e) {
    return { name: "Google (YouTube Data API)", tone: "bad", value: e instanceof Error ? e.message : String(e) };
  }
}
