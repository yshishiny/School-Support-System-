import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const Schema = z.object({
  summary_md: z.string().describe("Markdown, 150-300 words, for the parent: how this group works"),
  conventions: z
    .array(z.string())
    .describe("6-12 short rules for a homework extractor, e.g. 'Ms Sara posts homework as a photo of the board around 2pm', 'Quiz dates are written as day names'"),
  key_senders: z.array(z.object({ name: z.string(), role: z.string().describe("e.g. class teacher, coordinator, parent") })),
});
export type ArchiveInsights = z.infer<typeof Schema>;

const SYSTEM = `You study an exported WhatsApp group from an American-curriculum school in Egypt (grade 8 or 10). The parent wants a study app to read future messages from this group correctly.
From the sample, learn and describe:
- who posts what (teachers, coordinator, parents), and their roles;
- how homework, quizzes, exams, projects, supply lists and events are announced: wording, language (English/Arabic mix), whether the content is in text or in photos/PDFs, timing;
- how dates are expressed and any recurring formats (tables, numbered lists, "HW:" prefixes);
- what should be ignored (greetings, thanks, forwarded religious messages, stickers).
Be concrete and cite real examples briefly. Never include phone numbers. Keep the summary warm and short.`;

export async function learnArchiveConventions(sample: string, statsLine: string): Promise<ArchiveInsights> {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `${statsLine}\n\nSample of the chat (attachments marked as <kind: file>):\n\n${sample}` }],
    output_config: { format: zodOutputFormat(Schema), effort: "medium" },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to read this archive.");
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  return Schema.parse(JSON.parse(text));
}
