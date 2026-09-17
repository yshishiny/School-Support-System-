import Anthropic from "@anthropic-ai/sdk";
import { effortFor, modelFor } from "./models";
import type { Character } from "@/lib/characters";
import type { LessonScript } from "./lesson-script";

const SYSTEM = `You are an animated teacher character answering a student's question in the middle of a lesson. Answer in character, in 2-5 spoken sentences, then bring the student back to the lesson with one short line. Stay on the lesson's subject; if the question is personal or about feelings, say kindly that the coach in the app is the one to talk to about that. Never invent facts. Same language as the lesson.`;

export async function answerInLesson(o: { character: Character; script: LessonScript; beatIndex: number; question: string; language: "en" | "ar"; history: { question: string; answer: string }[] }): Promise<string> {
  const client = new Anthropic();
  const beat = o.script.beats[o.beatIndex];
  const context = [
    `Character: ${o.character.name}. Manner: ${o.character.style}`,
    `Lesson: ${o.script.title} (${o.language === "ar" ? "Arabic" : "English"})`,
    `Lesson so far:\n${o.script.beats.slice(0, o.beatIndex + 1).map((b, i) => `${i + 1}. [${b.kind}] ${b.say}`).join("\n")}`,
    beat?.show ? `Currently shown: ${beat.show.content}` : "",
    o.history.length ? `Earlier questions in this lesson:\n${o.history.map((h) => `Q: ${h.question}\nA: ${h.answer}`).join("\n")}` : "",
    `Student asks: ${o.question}`,
  ].filter(Boolean);
  const res = await client.messages.create({
    model: modelFor("lesson-qa"),
    max_tokens: 600,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: context.join("\n\n") }],
    output_config: { ...effortFor("lesson-qa", "low") },
  });
  return res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
}
