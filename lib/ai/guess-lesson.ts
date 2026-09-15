import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const Schema = z.object({
  reply: z.string().describe("One friendly sentence to the student, max 25 words"),
  suggestions: z
    .array(
      z.object({
        topic_id: z.string().nullable().describe("id of the matching curriculum topic, or null when it is not in the list"),
        title: z.string().describe("Short lesson title as a teacher would write it on the board"),
        why: z.string().describe("Why this fits the hint, max 12 words"),
      }),
    )
    .describe("2 to 3 guesses, most likely first"),
});
export type LessonGuess = z.infer<typeof Schema>;

export interface GuessSpec {
  grade: number | null;
  subject: string;
  hint: string;
  topics: { id: string; name: string; unit: string | null }[];
  recent: string[]; // recent notes for this subject, oldest first
}

const SYSTEM = `You help a student at an American-curriculum school in Egypt remember what today's class covered.
The student gives a vague hint ("something with triangles", "the war one", "cells"). Using the curriculum topic list and what was covered recently, guess the 2-3 most likely lesson titles.
Prefer topics that come right after the recently covered ones. Match a topic id from the list whenever one fits; otherwise give a sensible title with topic_id null.
Be warm and brief. Never lecture.`;

export async function guessLesson(spec: GuessSpec): Promise<LessonGuess> {
  const client = new Anthropic();
  const lines = [
    spec.grade ? `Grade: ${spec.grade}` : null,
    `Subject: ${spec.subject}`,
    `Student's hint: ${spec.hint}`,
    spec.recent.length ? `Recently covered (oldest first): ${spec.recent.join(" | ")}` : "Nothing logged yet this term.",
    `Curriculum topics (id: name [unit]):\n${spec.topics.map((t) => `- ${t.id}: ${t.name}${t.unit ? ` [${t.unit}]` : ""}`).join("\n")}`,
  ].filter(Boolean);
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 700,
    system: SYSTEM,
    messages: [{ role: "user", content: lines.join("\n") }],
    output_config: { format: zodOutputFormat(Schema), effort: "low" },
  });
  if (message.stop_reason === "refusal") throw new Error("The helper could not answer that.");
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  const parsed = Schema.parse(JSON.parse(text));
  const valid = new Set(spec.topics.map((t) => t.id));
  return { ...parsed, suggestions: parsed.suggestions.map((s) => ({ ...s, topic_id: s.topic_id && valid.has(s.topic_id) ? s.topic_id : null })).slice(0, 3) };
}
