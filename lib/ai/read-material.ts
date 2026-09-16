import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractedItemSchema } from "./extract-items";

export type MaterialInput = { media_type: "application/pdf" | "image/jpeg" | "image/png" | "image/webp"; data: string };

const MaterialSchema = z.object({
  title: z.string().describe("Short title a student would recognise, e.g. 'Unit 3 review: linear equations'"),
  kind: z.enum(["worksheet", "notes", "study_guide", "announcement", "other"]),
  subject: z.string().nullable().describe("Subject if it can be inferred, else null"),
  language: z.enum(["english", "arabic", "mixed"]),
  summary: z.string().describe("Two or three sentences for the parent: what this file is and what the student is expected to do with it"),
  topics: z.array(z.string()).max(12).describe("The specific topics or skills the file covers, in the file's language"),
  digest: z.string().describe("A compact study version of the content (max ~1500 words): key definitions, rules, worked examples, and the kinds of questions asked. Faithful to the file; no invention. Written so practice questions can be generated from it."),
  items: z.array(ExtractedItemSchema).describe("Tasks for the student. Only when the file or the instructions actually ask for something. Never invent dates."),
});
export type MaterialReading = z.infer<typeof MaterialSchema>;

const SYSTEM = `You read a school file (PDF or photo) shared in a class WhatsApp group at an American-curriculum international school in Egypt. Files may be in English or Arabic (Ministry subjects: Arabic, Religion, Social Studies).

Rules:
- Describe what the file is and what the student should do with it. Use the parent's instructions when given; they override your guess.
- The digest is for writing practice questions later: keep the actual content (formulas, definitions, facts, example problems, vocabulary), not commentary. Preserve Arabic in Arabic.
- Items: homework, quiz, exam, project, event, or note. Resolve dates against today's date given by the user; the Egyptian school week is Sunday to Thursday. If no date is stated anywhere, due_date is null and confidence is "low".
- If the file is unreadable, say so in the summary and return no items.`;

/** Reads one file with the fast model. PDFs up to 100 pages; images as they are. */
export async function readMaterial(doc: MaterialInput, ctx: { today: string; subject: string | null; instructions: string | null; grade: number | null; studentFirstName: string }): Promise<MaterialReading> {
  const client = new Anthropic();
  const lines = [`Today is ${ctx.today}.`, `Student: ${ctx.studentFirstName}${ctx.grade ? `, grade ${ctx.grade}` : ""}.`, ctx.subject ? `Subject chosen by the parent: ${ctx.subject}.` : "", ctx.instructions ? `Parent's instructions / what the teacher said: ${ctx.instructions}` : "", "Read the file and fill the fields."].filter(Boolean);
  const content: Anthropic.ContentBlockParam[] =
    doc.media_type === "application/pdf"
      ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.data } }, { type: "text", text: lines.join("\n") }]
      : [{ type: "image", source: { type: "base64", media_type: doc.media_type, data: doc.data } }, { type: "text", text: lines.join("\n") }];
  const stream = client.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: 12000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(MaterialSchema) },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to read this file.");
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  return MaterialSchema.parse(JSON.parse(text));
}
