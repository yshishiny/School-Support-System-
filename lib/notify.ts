import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegram, sendWhatsApp, type SendResult } from "@/lib/whatsapp/send";
import { sendPush } from "@/lib/push/server";

export interface ParentChannels { id: string; full_name: string; parent_label: string | null; telegram_chat_id: string | null; whatsapp: string | null }

/** Every parent account in the family with their delivery channels. */
export async function familyParents(familyId: string): Promise<ParentChannels[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, full_name, parent_label, telegram_chat_id, whatsapp").eq("family_id", familyId).eq("role", "parent").order("created_at");
  return (data ?? []) as ParentChannels[];
}

function whatsappReady(): boolean {
  const wa = (process.env.WHATSAPP_PROVIDER ?? "").toLowerCase();
  return (wa === "callmebot" && !!process.env.CALLMEBOT_API_KEY) || (wa === "meta" && !!process.env.META_WA_TOKEN);
}

/** Sends one text to a parent on every channel they connected. Success if any channel delivered. */
export async function sendToParent(p: Pick<ParentChannels, "id" | "telegram_chat_id" | "whatsapp">, text: string): Promise<SendResult> {
  const results: SendResult[] = [];
  if (p.telegram_chat_id) results.push(await sendTelegram(p.telegram_chat_id, text));
  // Browser notification with the first lines; the full text lives in the app.
  const push = await sendPush(p.id, { title: text.split("\n")[0].replace(/[*_]/g, "").slice(0, 60) || "Study Portal", body: text.split("\n").slice(1).join("\n").replace(/[*_]/g, "").slice(0, 300), url: "/parent", tag: "parent" });
  if (push.total > 0) results.push({ channel: "push", ok: push.sent > 0, error: push.error });
  if (whatsappReady() && p.whatsapp) results.push(await sendWhatsApp(p.whatsapp, text));
  if (results.length === 0) return { channel: "none", ok: false, error: "No delivery channel connected" };
  const ok = results.filter((r) => r.ok);
  if (ok.length) return { channel: ok.map((r) => r.channel).join("+"), ok: true };
  return { channel: results.map((r) => r.channel).join("+"), ok: false, error: results.map((r) => `${r.channel}: ${r.error}`).join(" | ") };
}

/**
 * Sends a text to every parent in the family (both parents always get safety alerts and reports).
 * `textFor` lets the report differ per parent (e.g. "the boys are with you tonight").
 */
export async function notifyParents(familyId: string, textFor: string | ((p: ParentChannels) => string)): Promise<SendResult & { delivered: number; parents: number }> {
  const parents = await familyParents(familyId);
  if (parents.length === 0) return { channel: "none", ok: false, error: "No parent account", delivered: 0, parents: 0 };
  const results = await Promise.all(parents.map((p) => sendToParent(p, typeof textFor === "string" ? textFor : textFor(p))));
  const ok = results.filter((r) => r.ok);
  const channels = [...new Set(results.filter((r) => r.channel !== "none").map((r) => r.channel))];
  if (ok.length) return { channel: channels.join("+"), ok: true, delivered: ok.length, parents: parents.length };
  if (channels.length === 0) return { channel: "none", ok: false, error: "No delivery channel configured: connect Telegram under More", delivered: 0, parents: parents.length };
  return { channel: channels.join("+"), ok: false, error: results.map((r, i) => `${parents[i].full_name.split(" ")[0]}: ${r.error}`).join(" | "), delivered: 0, parents: parents.length };
}
