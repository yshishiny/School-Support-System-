import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { modelFor } from "./models";
import { materialBlocks, type MaterialInput } from "./read-material";

const Item = z.object({
  subject: z.string(),
  grade: z.string().describe("As written: 87, A-, 18/20…"),
  percent: z.number().min(0).max(100).nullable().describe("The grade as a percentage when it can be derived, else null"),
  comment: z.string().nullable().describe("Teacher's comment if any, short"),
});
const Schema = z.object({
  period: z.string().describe("What the sheet covers, e.g. 'September 2026', 'Quarter 1'"),
  items: z.array(Item),
  average: z.number().min(0).max(100).nullable(),
  appraisal: z.string().describe("Four to six sentences for the parent and the student: what stands out, what improved or slipped versus the previous average if given, two concrete next steps. Warm, specific, no empty praise."),
});
export type GradesReading = z.infer<typeof Schema>;

const SYSTEM = `You read a photo or PDF of a school grades sheet (report card, monthly assessment) from an American-curriculum school in Egypt; Arabic Ministry subjects may appear in Arabic. Transcribe each subject and grade exactly as printed; compute a percentage only when the scale is clear (out of 100, out of 20, letter grades on the standard US scale). Never invent a subject or a number. If the sheet is unreadable, return no items and say so in the appraisal.`;

export async function readGrades(doc: MaterialInput, ctx: { studentFirstName: string; grade: number | null; previousAverage: number | null }): Promise<GradesReading> {
  const client = new Anthropic();
  const content: Anthropic.ContentBlockParam[] = materialBlocks(doc);
  content.push({ type: "text", text: `Student: ${ctx.studentFirstName}${ctx.grade ? `, grade ${ctx.grade}` : ""}. ${ctx.previousAverage !== null ? `Previous month's average: ${ctx.previousAverage}%.` : "No previous sheet on record."} Read the sheet.` });
  const stream = client.messages.stream({ model: modelFor("read-material"), max_tokens: 4000, system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content }], output_config: { format: zodOutputFormat(Schema) } });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to read this sheet.");
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  return Schema.parse(JSON.parse(text));
}
