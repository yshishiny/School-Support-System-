import Anthropic from "@anthropic-ai/sdk";
import { modelFor } from "./models";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const ExtractedItemSchema = z.object({
  kind: z.enum(["homework", "quiz", "exam", "project", "event", "note"]),
  title: z.string().describe("Short, specific title a student would recognise, e.g. 'Math p.45 ex 1-10'"),
  subject: z.string().nullable().describe("Subject name if it can be inferred, else null"),
  details: z.string().nullable().describe("Anything the student needs to know to do it"),
  due_date: z.string().nullable().describe("YYYY-MM-DD when the work is due or the quiz/exam happens; null if unknown"),
  source_excerpt: z.string().describe("The original message text this came from, trimmed"),
  confidence: z.enum(["high", "medium", "low"]),
});
export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

const ExtractionSchema = z.object({
  items: z.array(ExtractedItemSchema),
  summary: z.string().describe("One or two sentences for the parent about what the group discussed"),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

const SYSTEM = `You read exported WhatsApp messages from a school class group (American-curriculum international school in Egypt) and extract every actionable item for one student.

Rules:
- Extract homework, quizzes, exams, projects, and events (trips, dress-up days, things to bring). Use "note" for important information that is not a task (e.g. schedule change).
- Resolve relative dates ("tomorrow", "next Sunday", "Wednesday") against the message's own timestamp. The Egyptian school week runs Sunday to Thursday; the weekend is Friday and Saturday.
- One item per task. If a message lists homework for three subjects, produce three items.
- Skip chit-chat, thanks, and duplicates. If a later message corrects an earlier one, keep only the corrected version.
- Titles are short and specific. Details keep page numbers, exercise numbers, and links.
- Never invent dates. If unsure, set due_date to null and confidence to "low".`;

export async function extractItemsFromMessages(renderedMessages: string, today: string, conventions: string[] = []): Promise<Extraction> {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: modelFor("extract"),
    max_tokens: 32000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Today is ${today}.${conventions.length ? ` What we know about this group:\n- ${conventions.join("\n- ")}\n\n` : " "}Extract the items from these messages:\n\n${renderedMessages}`,
      },
    ],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error("The model declined to process this export.");
  }
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return ExtractionSchema.parse(JSON.parse(text));
}
