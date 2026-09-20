import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/ops/log";
import { extractText } from "@/lib/materials/extract-text";
import { decideWeek } from "@/lib/materials/week";
import { MATERIAL_BUCKET } from "@/lib/materials/server";
import { readMaterial, type MaterialInput } from "@/lib/ai/read-material";

/**
 * Reading an uploaded file with the AI and storing what came back.
 *
 * This is the engine behind registering a file and behind the nightly retry, and it lives here rather than in
 * `lib/actions/materials.ts` because that module is `"use server"`: everything it exports is a callable endpoint,
 * so a shared helper could not be exported from it without also being published.
 */
export interface RegisterMaterialResult { error?: string; id?: string; title?: string; summary?: string; items?: number }

export function friendlyAiError(msg: string): string {
  if (/credit balance is too low/i.test(msg)) return "The AI account is out of credit. Top up at console.anthropic.com (Plans & Billing), then tap “Read again”.";
  if (/rate limit|overloaded|529/i.test(msg)) return "The AI is busy right now. Tap “Read again” in a minute.";
  if (/100 pages|too many pages|page limit/i.test(msg)) return "This PDF has more than 100 pages. Split it by chapter and upload the parts.";
  return msg.length > 300 ? msg.slice(0, 300) + "…" : msg;
}

/** PDFs and images go to the model as they are; Office, CSV and text files as extracted text. */
export function toInput(buf: Buffer, mime: string, name: string): MaterialInput {
  const text = extractText(buf, mime);
  if (text !== null) return { media_type: "text/plain", text, name };
  return { media_type: mime as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", data: buf.toString("base64") };
}

/** Runs the AI reading on a stored file and saves the result (or a friendly error). */

export async function readAndStore(id: string, o: { path: string; mime: string; subject: string | null; instructions: string | null; fallbackTitle: string; grade: number | null; firstName: string; today: string; weekChoice?: "this" | "last" | null }): Promise<RegisterMaterialResult> {
  const admin = createAdminClient();
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
    const { data: file } = await admin.storage.from(MATERIAL_BUCKET).download(o.path);
    if (!file) throw new Error("Could not read the uploaded file back.");
    const buf = Buffer.from(await file.arrayBuffer());
    const reading0 = await readMaterial(toInput(buf, o.mime, o.fallbackTitle), { today: o.today, subject: o.subject, instructions: o.instructions, grade: o.grade, studentFirstName: o.firstName });
    const reading = reading0;
    // Week summaries: which week the syllabus covers, and a note when the dates in the file look wrong.
    const isWeek = !!o.weekChoice || reading.is_week_summary;
    const decision = isWeek ? decideWeek(o.today, o.weekChoice ?? null, reading.covers_from, reading.covers_to) : null;
    const weekFields = isWeek ? { is_week_summary: true, covers_week_start: decision!.coversWeekStart, covers_from: reading.covers_from, covers_to: reading.covers_to, date_note: decision!.note, subjects: reading.subjects } : { subjects: reading.subjects };
    await admin
      .from("materials")
      .update({ status: "ready", title: reading.title.slice(0, 120) || o.fallbackTitle, subject: o.subject ?? reading.subject, kind: reading.kind, summary: reading.summary, language: reading.language, topics: reading.topics, digest: reading.digest.slice(0, 20000), items: reading.items, items_reviewed_at: null, error: null, ...weekFields })
      .eq("id", id);
    return { id, title: reading.title, summary: reading.summary, items: reading.items.length };
  } catch (err) {
    const msg = friendlyAiError(err instanceof Error ? err.message : String(err));
    await logError("materials.read", err, { meta: { materialId: id, mime: o.mime, title: o.fallbackTitle } });
    await admin.from("materials").update({ status: "failed", error: msg }).eq("id", id);
    return { id, title: o.fallbackTitle, summary: `Saved, but the AI could not read it. ${msg}`, items: 0 };
  }
}
