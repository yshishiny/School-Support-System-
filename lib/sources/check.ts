import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractItemsFromMessages } from "@/lib/ai/extract-items";
import { notifyParents } from "@/lib/notify";
import { todayIn } from "@/lib/dates";

/** Turns a web page into readable text: drops scripts, styles and tags; keeps line breaks around blocks. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export interface CheckResult {
  changed: boolean;
  items: number;
  error?: string;
}

/** Fetches one source, and when its text changed since last time, asks the extractor for announcements and stores them for review. */
export async function checkSource(source: { id: string; family_id: string; label: string; url: string; last_hash: string | null }): Promise<CheckResult> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  try {
    const res = await fetch(source.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; family-study-portal/1.0)" }, signal: AbortSignal.timeout(15000), redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = htmlToText(await res.text()).slice(0, 40000);
    if (text.length < 200) throw new Error("The page has almost no readable text (it may need a login, or load with scripts).");
    const hash = createHash("sha256").update(text).digest("hex");
    if (hash === source.last_hash) {
      await admin.from("sources").update({ last_checked_at: now, last_error: null }).eq("id", source.id);
      return { changed: false, items: 0 };
    }
    const { data: family } = await admin.from("families").select("timezone").eq("id", source.family_id).single();
    const today = todayIn(family?.timezone ?? "Africa/Cairo");
    const extraction = await extractItemsFromMessages(`[${today}] Page: ${source.label} (${source.url})\n${text}`, today, ["This is a school website or announcements page, not a chat: extract dated announcements, events, exams, holidays, supply lists and deadlines that are still ahead; skip navigation text, old news and boilerplate."]);
    await admin.from("source_findings").insert({ source_id: source.id, family_id: source.family_id, summary: extraction.summary, items: extraction.items });
    await admin.from("sources").update({ last_checked_at: now, last_hash: hash, last_error: null }).eq("id", source.id);
    await notifyParents(source.family_id, `🏫 *${source.label}* has news.\n${extraction.summary}\n${extraction.items.length} item${extraction.items.length === 1 ? "" : "s"} waiting for your approval under Import.`);
    return { changed: true, items: extraction.items.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from("sources").update({ last_checked_at: now, last_error: msg }).eq("id", source.id);
    return { changed: false, items: 0, error: msg };
  }
}

/** Sources due for a check: never checked, or older than six days. */
export async function checkDueSources(): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 6 * 86400000).toISOString();
  const { data: sources } = await admin.from("sources").select("id, family_id, label, url, last_hash, last_checked_at").eq("enabled", true);
  const out: Record<string, string> = {};
  for (const s of sources ?? []) {
    if (s.last_checked_at && s.last_checked_at > cutoff) continue;
    const r = await checkSource(s);
    out[s.label] = r.error ? `error: ${r.error}` : r.changed ? `${r.items} items` : "unchanged";
  }
  return out;
}
