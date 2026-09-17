"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Hourly reminders from inside the database: pg_cron calls /api/cron/nudges every hour once the app's own cron secret
 * and address are stored. The secret never leaves the server: this action copies it from the environment.
 */
export async function enableHourlySchedulerAction(): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const secret = process.env.CRON_SECRET;
  if (!secret) return { error: "CRON_SECRET is not set on the server." };
  const h = await headers();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`).replace(/\/$/, "");
  const admin = createAdminClient();
  const { error } = await admin.from("ops_settings").upsert([{ key: "cron_secret", value: secret, updated_at: new Date().toISOString() }, { key: "app_url", value: appUrl, updated_at: new Date().toISOString() }]);
  if (error) return { error: error.message };
  revalidatePath("/parent/admin");
  return { ok: true };
}

export async function disableHourlySchedulerAction(): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("ops_settings").delete().in("key", ["cron_secret"]);
  revalidatePath("/parent/admin");
}

export async function schedulerStatus(): Promise<{ enabled: boolean; appUrl: string | null; lastRun: string | null; lastOk: boolean | null }> {
  const admin = createAdminClient();
  const [{ data: rows }, { data: run }] = await Promise.all([
    admin.from("ops_settings").select("key, value").in("key", ["cron_secret", "app_url"]),
    admin.from("cron_runs").select("started_at, ok").eq("job", "nudges").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
  return { enabled: map.has("cron_secret"), appUrl: map.get("app_url") ?? null, lastRun: run?.started_at ?? null, lastOk: run?.ok ?? null };
}
