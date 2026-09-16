import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PushPayload { title: string; body: string; url?: string; tag?: string }

function configured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function setup() {
  if (ready || !configured()) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

/** Sends a browser notification to every device the user allowed. Dead subscriptions are removed. */
export async function sendPush(userId: string, payload: PushPayload): Promise<{ sent: number; total: number; error?: string }> {
  if (!configured()) return { sent: 0, total: 0, error: "VAPID keys not configured" };
  setup();
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  if (!subs?.length) return { sent: 0, total: 0, error: "No device subscribed" };
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 });
      sent += 1;
      await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return { sent, total: subs.length, error: sent ? undefined : "Delivery failed" };
}

export async function hasPush(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count } = await admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return (count ?? 0) > 0;
}
