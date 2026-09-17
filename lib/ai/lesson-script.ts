import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { effortFor, modelFor } from "./models";
import { normaliseQuestions } from "./generate-quiz";
import type { Character } from "@/lib/characters";

const ShowSchema = z.object({
  type: z.enum(["text", "steps", "formula", "table", "svg"]).describe("text: 1-3 short lines · steps: numbered lines separated by newlines · formula: one formula in unicode · table: rows as 'a | b | c' lines · svg: a small self-contained <svg> (max 600 chars, viewBox 0 0 320 180, no scripts)"),
  content: z.string(),
});
const CheckSchema = z.object({
  question: z.string(),
  choices: z.array(z.string()),
  correct_index: z.number().int().min(0).max(3),
  hint: z.string().describe("One sentence the teacher says after a wrong answer, before the second try"),
  explanation: z.string().describe("Two sentences after the second try or a correct answer"),
});
const BeatSchema = z.object({
  kind: z.enum(["hook", "explain", "example", "check", "recap"]),
  say: z.string().describe("What the teacher says aloud, 35-90 words, in character, spoken language, no markdown"),
  show: ShowSchema.nullable(),
  check: CheckSchema.nullable().describe("Only for kind 'check'"),
});
const QuizItem = z.object({
  prompt: z.string(),
  choices: z.array(z.string()),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string(),
  skill_tag: z.string(),
});
export const LessonScriptSchema = z.object({
  title: z.string(),
  minutes: z.number().int().min(5).max(20),
  beats: z.array(BeatSchema).min(6).max(12),
  quiz: z.array(QuizItem).min(3).max(3),
});
export type LessonScript = z.infer<typeof LessonScriptSchema>;

const SYSTEM = `You write a short spoken lesson for one teenage student at an American-curriculum school in Egypt, to be performed by an animated teacher character. The student hears each beat read aloud and sees one visual per beat.

Structure (6 to 12 beats): hook (1) → explain (2-4) → example (1-2, every step shown) → check (2-3, spread through the lesson, four choices each) → recap (1). Total spoken time 8-15 minutes.

Rules:
- Faithful to the source: the school file first, then the curriculum topic. Never invent facts, dates or formulas.
- "say" is spoken language: short sentences, no markdown, no bullet symbols, numbers written so they read well aloud. Stay in the character's manner but keep the teaching clear; the character adds warmth, not noise.
- "show" carries the content the ear cannot hold: formulas, steps, tables, a simple SVG diagram. Unicode math only (x², √, ×, ÷, π). Keep SVGs simple: lines, circles, rects, text.
- Checks test the idea just taught. Hints do not give the answer away.
- The final quiz has exactly 3 questions on the whole lesson; prefix each skill_tag with the subject name and a colon.
- Arabic lessons: everything in clear Modern Standard Arabic (Egyptian Ministry textbooks style), including the visuals.`;

export interface LessonSpec {
  subject: string;
  unit: string | null;
  topic: string;
  grade: number | null;
  language: "en" | "ar";
  character: Character;
  sourceText?: string | null; // a school file's digest
  learner?: string | null;
  interests?: string | null;
}

export async function generateLessonScript(spec: LessonSpec): Promise<LessonScript & { model: string }> {
  const client = new Anthropic();
  const model = modelFor("lesson");
  const lines = [
    `Subject: ${spec.subject}${spec.unit ? ` · Unit: ${spec.unit}` : ""}`,
    `Topic: ${spec.topic}`,
    spec.grade ? `Grade: ${spec.grade}` : null,
    `Language: ${spec.language === "ar" ? "Arabic" : "English"}`,
    `Teacher character: ${spec.character.name}. Manner: ${spec.character.style} Catchphrase (use at most once, in the hook or recap): "${spec.character.catchphrase}"`,
    spec.learner ? `${spec.learner} Shape the explanations to this.` : null,
    spec.interests ? `Student's interests, for one or two examples only: ${spec.interests}` : null,
    spec.sourceText ? `SOURCE FILE (teach from this; the curriculum topic is only context):\n"""\n${spec.sourceText.slice(0, 12000)}\n"""` : null,
  ].filter(Boolean);
  const stream = client.messages.stream({
    model,
    max_tokens: 12000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: lines.join("\n") }],
    output_config: { format: zodOutputFormat(LessonScriptSchema), ...effortFor("lesson", "medium") },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to write this lesson.");
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  const raw = LessonScriptSchema.parse(JSON.parse(text));
  // Repair four-choice rules on checks and quiz; drop a check that cannot be repaired.
  const beats = raw.beats
    .map((b) => (b.kind === "check" && b.check ? { ...b, check: normaliseQuestions([{ ...b.check, choices: b.check.choices }])[0] ?? null } : b))
    .filter((b) => b.kind !== "check" || b.check);
  const quiz = normaliseQuestions(raw.quiz);
  return { ...raw, beats, quiz: quiz.length ? quiz : raw.quiz, model };
}
