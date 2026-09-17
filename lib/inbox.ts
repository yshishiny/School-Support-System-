/** The parent's in-app inbox: a copy of everything the app sends (or would send) to a parent. */
import { createAdminClient } from "@/lib/supabase/admin";

export type InboxKind = "report" | "alert" | "allowance" | "news" | "ping" | "info";
export const INBOX_EMOJI: Record<InboxKind, string> = { report: "📨", alert: "🚨", allowance: "💵", news: "🏫", ping: "⚡", info: "ℹ️" };
export const INBOX_LABEL: Record<InboxKind, string> = { report: "Daily report", alert: "Safety alert", allowance: "Allowance", news: "School news", ping: "Live ping", info: "Note" };

/** Guesses the kind from the first line of a Telegram-style text when the caller did not say. */
export function inboxKindFor(text: string): InboxKind {
  const head = text.split("\n")[0];
  if (/report/i.test(head) || head.startsWith("📨")) return "report";
  if (/allowance/i.test(head) || head.startsWith("💵")) return "allowance";
  if (/🚨|💛|please talk|heads-up|alert/i.test(head)) return "alert";
  if (head.startsWith("🏫") || /news/i.test(head)) return "news";
  return "info";
}

export function splitText(text: string): { title: string; body: string } {
  const lines = text.split("\n");
  const title = lines[0].replace(/[*_]/g, "").trim().slice(0, 120) || "Study Portal";
  const body = lines.slice(1).join("\n").replace(/\*(.+?)\*/g, "$1").trim();
  return { title, body };
}

export async function addToInbox(familyId: string, parentId: string, item: { kind: InboxKind; title: string; body?: string; url?: string | null }): Promise<void> {
  const admin = createAdminClient();
  await admin.from("parent_notifications").insert({ family_id: familyId, parent_id: parentId, kind: item.kind, title: item.title.slice(0, 120), body: (item.body ?? "").slice(0, 4000), url: item.url ?? null }).then(() => null, () => null);
}

export async function unreadCount(parentId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin.from("parent_notifications").select("id", { count: "exact", head: true }).eq("parent_id", parentId).is("read_at", null);
  return count ?? 0;
}
