import Anthropic from "@anthropic-ai/sdk";
import { modelFor } from "./models";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractedItemSchema, type ExtractedItem } from "./extract-items";

export type MaterialInput = { media_type: "application/pdf" | "image/jpeg" | "image/png" | "image/webp"; data: string } | { media_type: "text/plain"; text: string; name?: string };

/**
 * The shape the model is asked for. Deliberately loose (plain strings where the app wants enums, no array caps):
 * the small model sometimes returns 14 topics or "Worksheet" with a capital, and a strict schema threw the whole
 * reading away. normalise() below turns it into the exact shape the app stores.
 */
const LooseItemSchema = z.object({
  kind: z.string().describe("One of: homework, quiz, exam, project, event, note"),
  title: z.string().describe("Short, specific title a student would recognise, e.g. 'Math p.45 ex 1-10'"),
  subject: z.string().nullable().describe("Subject name if it can be inferred, else null"),
  details: z.string().nullable().describe("Anything the student needs to know to do it"),
  due_date: z.string().nullable().describe("YYYY-MM-DD when the work is due or the quiz/exam happens; null if unknown"),
  source_excerpt: z.string().describe("The original text this came from, trimmed"),
  confidence: z.string().describe("One of: high, medium, low"),
});
const MaterialSchema = z.object({
  title: z.string().describe("Short title a student would recognise, e.g. 'Unit 3 review: linear equations'"),
  kind: z.string().describe("One of: worksheet, notes, study_guide, announcement, other"),
  subject: z.string().nullable().describe("Subject if it can be inferred, else null"),
  language: z.string().describe("One of: english, arabic, mixed"),
  summary: z.string().describe("Two or three sentences for the parent: what this file is and what the student is expected to do with it"),
  topics: z.array(z.string()).describe("The specific topics or skills the file covers, in the file's language; at most 12, most important first"),
  digest: z.string().describe("A compact study version of the content (max ~1500 words): key definitions, rules, worked examples, and the kinds of questions asked. Faithful to the file; no invention. Written so practice questions can be generated from it."),
  items: z.array(LooseItemSchema).describe("Tasks for the student. Only when the file or the instructions actually ask for something. Never invent dates."),
  is_week_summary: z.boolean().describe("true when the file is a weekly syllabus / weekly plan / week summary listing what each subject covers in one week"),
  covers_from: z.string().nullable().describe("For a week summary: the first date the file itself states, as YYYY-MM-DD (read day/month order carefully: Egyptian schools write D/M/YYYY); null if none stated"),
  covers_to: z.string().nullable().describe("For a week summary: the last date the file states, YYYY-MM-DD; null if none"),
  subjects: z.array(z.object({ subject: z.string(), topics: z.array(z.string()) })).describe("For a week summary: one entry per subject with the topics listed for it, in the file's words. Empty for other files."),
});
export interface MaterialReading {
  title: string;
  kind: "worksheet" | "notes" | "study_guide" | "announcement" | "other";
  subject: string | null;
  language: "english" | "arabic" | "mixed";
  summary: string;
  topics: string[];
  digest: string;
  items: ExtractedItem[];
  is_week_summary: boolean;
  covers_from: string | null;
  covers_to: string | null;
  subjects: { subject: string; topics: string[] }[];
}

const KINDS = ["worksheet", "notes", "study_guide", "announcement", "other"] as const;
const LANGS = ["english", "arabic", "mixed"] as const;
const ITEM_KINDS = ["homework", "quiz", "exam", "project", "event", "note"] as const;
const CONF = ["high", "medium", "low"] as const;
const pick = <T extends string>(v: string, allowed: readonly T[], fallback: T): T => (allowed as readonly string[]).includes(v.trim().toLowerCase().replace(/[\s-]+/g, "_")) ? (v.trim().toLowerCase().replace(/[\s-]+/g, "_") as T) : fallback;

/** Exact app shape from the loose model output: unknown enum values fall back, lists are capped, bad items dropped. */
export function normaliseReading(raw: z.infer<typeof MaterialSchema>): MaterialReading {
  const items: ExtractedItem[] = [];
  for (const it of raw.items ?? []) {
    const r = ExtractedItemSchema.safeParse({ ...it, kind: pick(it.kind ?? "", ITEM_KINDS, "note"), confidence: pick(it.confidence ?? "", CONF, "low"), due_date: it.due_date && /^\d{4}-\d{2}-\d{2}$/.test(it.due_date) ? it.due_date : null, source_excerpt: it.source_excerpt ?? "", subject: it.subject ?? null, details: it.details ?? null });
    if (r.success) items.push(r.data);
  }
  return {
    title: (raw.title ?? "").trim().slice(0, 120) || "School file",
    kind: pick(raw.kind ?? "", KINDS, "other"),
    subject: raw.subject?.trim() || null,
    language: pick(raw.language ?? "", LANGS, "mixed"),
    summary: (raw.summary ?? "").trim(),
    topics: [...new Set((raw.topics ?? []).map((t) => t.trim()).filter(Boolean))].slice(0, 12),
    digest: raw.digest ?? "",
    items,
    is_week_summary: !!raw.is_week_summary,
    covers_from: raw.covers_from && /^\d{4}-\d{2}-\d{2}$/.test(raw.covers_from) ? raw.covers_from : null,
    covers_to: raw.covers_to && /^\d{4}-\d{2}-\d{2}$/.test(raw.covers_to) ? raw.covers_to : null,
    subjects: (raw.subjects ?? []).map((s) => ({ subject: (s.subject ?? "").trim(), topics: (s.topics ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12) })).filter((s) => s.subject).slice(0, 20),
  };
}


const SYSTEM = `You read a school file (PDF, photo, Word, PowerPoint, Excel, CSV or text) shared in a class WhatsApp group at an American-curriculum international school in Egypt. Files may be in English or Arabic (Ministry subjects: Arabic, Religion, Social Studies).

Rules:
- Describe what the file is and what the student should do with it. Use the parent's instructions when given; they override your guess.
- The digest is for writing practice questions later: keep the actual content (formulas, definitions, facts, example problems, vocabulary), not commentary. Preserve Arabic in Arabic.
- Items: homework, quiz, exam, project, event, or note. Resolve dates against today's date given by the user; the Egyptian school week is Sunday to Thursday. If no date is stated anywhere, due_date is null and confidence is "low".
- Weekly syllabus / week plan files (one row per subject with what is covered that week): set is_week_summary true, copy the dates the file states (D/M/YYYY in Egypt: "1/3/2026" is 1 March), and fill subjects with one entry per subject. Do not judge whether the dates are right; the app checks that.
- If the file is unreadable, say so in the summary and return no items.`;

/** The file as the model takes it: a PDF document, an image, or the extracted text of an Office/CSV/text file. */
export function materialBlocks(doc: MaterialInput, prompt?: string): Anthropic.ContentBlockParam[] {
  const tail: Anthropic.ContentBlockParam[] = prompt ? [{ type: "text", text: prompt }] : [];
  if (doc.media_type === "text/plain") return [{ type: "text", text: `File${doc.name ? ` "${doc.name}"` : ""} (text extracted):\n\n${doc.text}` }, ...tail];
  if (doc.media_type === "application/pdf") return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.data } }, ...tail];
  return [{ type: "image", source: { type: "base64", media_type: doc.media_type, data: doc.data } }, ...tail];
}

/** Reads one file with the fast model. PDFs up to 100 pages; images as they are; Office and CSV as extracted text. */
export async function readMaterial(doc: MaterialInput, ctx: { today: string; subject: string | null; instructions: string | null; grade: number | null; studentFirstName: string }): Promise<MaterialReading> {
  const client = new Anthropic();
  const lines = [`Today is ${ctx.today}.`, `Student: ${ctx.studentFirstName}${ctx.grade ? `, grade ${ctx.grade}` : ""}.`, ctx.subject ? `Subject chosen by the parent: ${ctx.subject}.` : "", ctx.instructions ? `Parent's instructions / what the teacher said: ${ctx.instructions}` : "", "Read the file and fill the fields."].filter(Boolean);
  const content: Anthropic.ContentBlockParam[] = materialBlocks(doc, lines.join("\n"));
  const stream = client.messages.stream({
    model: modelFor("read-material"),
    max_tokens: 12000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(MaterialSchema) },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to read this file.");
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  return normaliseReading(MaterialSchema.parse(JSON.parse(text)));
}
