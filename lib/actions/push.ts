"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { failed } from "@/lib/ops/fault";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push/server";
import { DEFAULT_NUDGES, type NudgeSettings } from "@/lib/nudges";

export interface SubscriptionInput { endpoint: string; keys: { p256dh: string; auth: string } }

/** The browser subscribed; keep the subscription for this user (one row per device). */
export async function savePushSubscriptionAction(sub: SubscriptionInput): Promise<{ error?: string }> {
  const { profile } = await requireSession();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Bad subscription." };
  const h = await headers();
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert({ user_id: profile.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: (h.get("user-agent") ?? "").slice(0, 200) }, { onConflict: "endpoint" });
  if (error) return failed("actions.push.savePushSubscription", error);
  ["/me", "/parent/settings"].forEach((p) => revalidatePath(p));
  return {};
}

export async function removePushSubscriptionAction(endpoint: string): Promise<void> {
  const { profile } = await requireSession();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("user_id", profile.id).eq("endpoint", endpoint);
  ["/me", "/parent/settings"].forEach((p) => revalidatePath(p));
}

/** A test notification to this user's devices. */
export async function testPushAction(): Promise<{ error?: string; sent?: number }> {
  const { profile } = await requireSession();
  const r = await sendPush(profile.id, { title: "Study Portal 👋", body: `Notifications work, ${profile.full_name.split(" ")[0]}. Reminders will arrive here.`, url: profile.role === "parent" ? "/parent" : "/today", tag: "test" });
  return r.error && !r.sent ? { error: r.error } : { sent: r.sent };
}

/** Which reminders the child wants. */
export async function setNudgesAction(settings: Partial<NudgeSettings>): Promise<void> {
  const { profile } = await requireSession();
  const supabase = await createClient();
  const next: NudgeSettings = { ...DEFAULT_NUDGES, ...((profile as { nudges?: Partial<NudgeSettings> }).nudges ?? {}), ...settings };
  await supabase.from("profiles").update({ nudges: next }).eq("id", profile.id);
  revalidatePath("/me");
}
