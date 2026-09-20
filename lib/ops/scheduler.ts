import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Whether the nightly job is wired up, and how it went last night. Read by the Admin page.
 *
 * A server helper, not an action: it reads operational settings with the service-role key and answers with no
 * question of who is asking, so it must not be callable from outside the code that has already checked.
 */

export async function schedulerStatus(): Promise<{ enabled: boolean; appUrl: string | null; lastRun: string | null; lastOk: boolean | null }> {
  const admin = createAdminClient();
  const [{ data: rows }, { data: run }] = await Promise.all([
    admin.from("ops_settings").select("key, value").in("key", ["cron_secret", "app_url"]),
    admin.from("cron_runs").select("started_at, ok").eq("job", "nudges").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
  return { enabled: map.has("cron_secret"), appUrl: map.get("app_url") ?? null, lastRun: run?.started_at ?? null, lastOk: run?.ok ?? null };
}
