/**
 * Turning a school sheet into questions a child can answer on his phone, without anybody remembering to ask.
 *
 * This existed already as a button. A parent uploaded the sheet, the reader read it, and then somebody had to
 * notice a second button and press it before the child could do anything but look at a PDF. Nobody did: of
 * Omar's seven worksheets three had been transcribed, and of Youssef's six files none had. The button was not
 * the feature; pressing it was, and it was left to the person least likely to be holding the phone.
 *
 * So it runs on its own now, in three places, because each one covers a different way the first can fail:
 *
 * 1. **The uploader kicks it off** for each file the reader says has questions, all of them at once, after the
 *    reads are done. Not inside the read: that would double the time a parent waits per file, on the one part
 *    of the app already slow enough to complain about, and risk the whole upload hitting the function timeout.
 * 2. **The nightly sweep** picks up whatever the uploader did not — a closed tab, a dropped connection, a
 *    model that was busy. This is also what cleared the backlog that existed when this was written.
 * 3. **The button stays**, for a sheet worth transcribing again, and now reports what went wrong last time
 *    instead of leaving a parent to guess why a sheet is still not answerable.
 *
 * A failure is written to the row rather than thrown. An unanswerable sheet is a disappointment; an upload
 * that fails because the *second* AI call failed would be a regression.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/ops/log";
import { transcribeWorksheet } from "@/lib/ai/transcribe-worksheet";
import { friendlyAiError, toInput } from "@/lib/materials/read";
import { MATERIAL_BUCKET, type MaterialRow } from "@/lib/materials/server";

/** Enough of a material row to decide whether it is worth an AI call. */
export interface Candidate {
  status: string;
  kind: string | null;
  hasQuestions: boolean | null;
  worksheet: unknown;
}

/**
 * Whether this file should be turned into answerable questions.
 *
 * `hasQuestions` is the reader's own answer and is trusted when it has one. Files read before that question
 * was asked have `null`, and for those the old `kind === "worksheet"` label is the best available guess — it
 * is what the manual button was gated on, so nothing that used to be offered stops being offered.
 */
export function wantsWorksheet(m: Candidate): boolean {
  if (m.status !== "ready") return false;
  if (m.worksheet) return false;
  return m.hasQuestions ?? m.kind === "worksheet";
}

/**
 * Whether to show the transcribe button at all.
 *
 * Wider than `wantsWorksheet`: a sheet that already has its questions still gets the button, because a bad
 * transcription is worth redoing. Narrower than "always": a letter to parents has nothing to transcribe and
 * the button on it only ever produced a wasted AI call and an apology.
 */
export function offersWorksheet(m: Candidate): boolean {
  return m.status === "ready" && (!!m.worksheet || (m.hasQuestions ?? m.kind === "worksheet"));
}

export interface Transcribed { questions: number; skipped: number; note: string }

/**
 * Transcribe one file and store the result. Never throws: the reason is written to the row.
 *
 * Takes the file bytes when the caller already has them, which the read path does — downloading the same PDF
 * twice in one request is a second round trip for nothing.
 */
export async function transcribeAndStore(
  id: string,
  m: { path: string; mime: string; title: string; subject: string | null; grade: number | null },
  bytes?: Buffer,
): Promise<Transcribed | { error: string }> {
  const admin = createAdminClient();
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
    let buf = bytes;
    if (!buf) {
      const { data: file } = await admin.storage.from(MATERIAL_BUCKET).download(m.path);
      if (!file) throw new Error("Could not read the file back.");
      buf = Buffer.from(await file.arrayBuffer());
    }
    const t = await transcribeWorksheet(toInput(buf, m.mime, m.title), { title: m.title, subject: m.subject, grade: m.grade });
    if (t.questions.length === 0) {
      // Not a failure worth retrying: the reader thought there were questions and the transcriber disagreed,
      // and it will disagree again. Recorded so the sheet stops being picked up every night.
      const note = t.note || "Nothing on this sheet could be turned into a question.";
      await admin.from("materials").update({ has_questions: false, worksheet_error: note }).eq("id", id);
      return { error: note };
    }
    await admin
      .from("materials")
      .update({
        worksheet: { questions: t.questions, skipped: t.skipped, note: t.note, model: t.model, prepared_at: new Date().toISOString() },
        worksheet_error: null,
      })
      .eq("id", id);
    return { questions: t.questions.length, skipped: t.skipped, note: t.note };
  } catch (err) {
    const msg = friendlyAiError(err instanceof Error ? err.message : String(err));
    await logError("materials.transcribe", err, { meta: { materialId: id, mime: m.mime, title: m.title } });
    await admin.from("materials").update({ worksheet_error: msg }).eq("id", id);
    return { error: msg };
  }
}

/** How many sheets one nightly run will transcribe. Each is an AI call over a whole PDF. */
const SWEEP_LIMIT = 8;

/**
 * Nightly: transcribe the sheets that have questions and no set yet.
 *
 * Oldest first, so a backlog drains in the order the children were given the work rather than the sweep
 * circling the newest few. A sheet that has already failed for a permanent reason has `has_questions` set
 * false by `transcribeAndStore`, so it is not picked again.
 */
export async function transcribePendingWorksheets(limit = SWEEP_LIMIT): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("materials")
    .select("id, path, mime, title, subject, status, kind, has_questions, worksheet, profiles!materials_student_id_fkey(grade)")
    .eq("status", "ready")
    .is("worksheet", null)
    .is("has_questions", true)
    .order("created_at")
    .limit(limit);
  const rows = (data ?? []) as unknown as (Pick<MaterialRow, "id" | "path" | "mime" | "title" | "subject" | "status" | "kind" | "worksheet"> & {
    has_questions: boolean | null;
    profiles: { grade: number | null } | null;
  })[];
  const out: string[] = [];
  for (const m of rows) {
    if (!wantsWorksheet({ status: m.status, kind: m.kind, hasQuestions: m.has_questions, worksheet: m.worksheet })) continue;
    const r = await transcribeAndStore(m.id, { path: m.path, mime: m.mime, title: m.title, subject: m.subject, grade: m.profiles?.grade ?? null });
    out.push("error" in r ? `${m.title}: ${r.error}` : `${m.title}: ${r.questions} questions`);
  }
  return out;
}
