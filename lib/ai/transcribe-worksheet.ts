import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { modelFor } from "./models";
import { normaliseQuestions } from "./generate-quiz";
import type { MaterialInput } from "./read-material";

const QuestionSchema = z.object({
  prompt: z.string().describe("The question exactly as written on the sheet (fix only obvious typos). Keep the sheet's number at the start, e.g. '12. …'"),
  choices: z.array(z.string()).describe("The four answer choices as written. For a fill-in-the-blank or table item, the correct answer plus three plausible wrong ones"),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().describe("Two short sentences: why the answer is right, in the language of the sheet"),
  skill_tag: z.string().describe("Short skill label, e.g. 'properties of gases'"),
  original_type: z.enum(["multiple_choice", "fill_blank", "table", "short_answer"]),
});
const Schema = z.object({
  questions: z.array(QuestionSchema),
  skipped: z.number().int().describe("Items on the sheet that could not be turned into a four-choice question (diagrams to label, open essays)"),
  note: z.string().describe("One sentence for the parent about what was kept and what was skipped"),
});
export type WorksheetTranscription = z.infer<typeof Schema>;

const SYSTEM = `You turn a school worksheet (PDF or photo) into a multiple-choice practice set the student does on a phone. Faithfulness first: this is the teacher's sheet, not new material.

Rules:
- Transcribe every multiple-choice question in order with its four choices, verbatim. Never invent questions that are not on the sheet.
- Fill-in-the-blank and table items: turn each into a four-choice question only when the answer is unambiguous; otherwise count it as skipped.
- Diagram-labelling and open essay items: skip and count them.
- Decide the correct answer from the sheet's own content and standard grade 8 science; when the sheet has an answer key, use it.
- Keep the language of the sheet (English or Arabic). Randomise which position the correct answer sits in only if the sheet gives none.
- Exactly four choices per question, never three, never five.`;

/** Reads the sheet and returns its questions with an answer key. One call per file; the result is stored. */
export async function transcribeWorksheet(doc: MaterialInput, ctx: { title: string; subject: string | null; grade: number | null }): Promise<WorksheetTranscription & { model: string }> {
  const client = new Anthropic();
  const model = modelFor("worksheet");
  const content: Anthropic.ContentBlockParam[] =
    doc.media_type === "application/pdf"
      ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.data } }]
      : [{ type: "image", source: { type: "base64", media_type: doc.media_type, data: doc.data } }];
  content.push({ type: "text", text: `Worksheet: ${ctx.title}${ctx.subject ? ` (${ctx.subject})` : ""}${ctx.grade ? `, grade ${ctx.grade}` : ""}. Transcribe it into practice questions.` });
  const stream = client.messages.stream({
    model,
    max_tokens: 32000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(Schema) },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to read this sheet.");
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  const raw = Schema.parse(JSON.parse(text));
  const questions = normaliseQuestions(raw.questions);
  return { ...raw, questions, skipped: raw.skipped + (raw.questions.length - questions.length), model };
}
