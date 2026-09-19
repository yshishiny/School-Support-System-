import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { effortFor, modelFor } from "./models";
import { normaliseQuestions } from "./generate-quiz";
import type { Character } from "@/lib/characters";

/** Scripts older than this are rewritten on the next start (illustrated scenes arrived in 2, spoken-word rules and tashkeel in 3). */
export const SCRIPT_VERSION = 3;

const CueSchema = z.object({
  phrase: z.string().describe("2-6 words copied verbatim from this beat's 'say'; when the teacher reaches them, the step appears"),
  step: z.number().int().min(1).max(8),
});
const ShowSchema = z.object({
  type: z.enum(["text", "steps", "formula", "table", "svg", "scene"]).describe("text: 1-3 short lines · steps: numbered lines separated by newlines · formula: one formula in unicode · table: rows as 'a | b | c' lines · svg: a small static <svg> (max 600 chars) · scene: a large illustrated diagram built step by step as the teacher speaks (see rules)"),
  content: z.string(),
  cues: z.array(CueSchema).nullable().describe("Only for type 'scene': one cue per step, in order. Null otherwise."),
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
  gesture: z.enum(["idle", "wave", "explain", "point", "write", "think", "celebrate", "listen", "oops", "bow"]).nullable().describe("How the animated teacher moves during this beat: wave (greeting), explain (open hands), point (at the board), write (on the board), think (hand on chin, for checks), celebrate (arms up, recap), bow (thanks). Null lets the stage decide."),
  mood: z.enum(["neutral", "happy", "think", "surprised", "encourage", "sad"]).nullable().describe("The teacher's face during this beat. Null lets the stage decide."),
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
- "say" is read aloud by a text-to-speech voice, so it must be pure spoken language: short sentences, no markdown, no bullet symbols, NO mathematical symbols or notation at all. Write "three eighths plus two eighths equals five eighths", "x squared", "angle A", "ninety degrees", "line A B is parallel to line C D", "the square root of sixteen"; never "3/8 + 2/8 = 5/8", "x²", "∠A", "90°", "AB ∥ CD", "√16". Spell out numbers under one hundred. Units and abbreviations in full ("centimetres", "for example"). Symbols belong in "show", never in "say". Stay in the character's manner but keep the teaching clear; the character adds warmth, not noise.
- Arabic "say": fully vowelled (تشكيل كامل على كل كلمة) so the voice pronounces every word correctly, in clear Modern Standard Arabic; numbers written as words (ثلاثةُ أثمانٍ). "show" and the quiz stay without tashkeel.
- "show" carries the content the ear cannot hold: formulas, steps, tables, diagrams. Unicode math only (x², √, ×, ÷, π).
- ILLUSTRATE. Every explain and example beat in math, science, geography and technical subjects, and every beat where an object, shape, process, map, timeline or apparatus is described, uses show.type "scene": a large diagram of the very thing being talked about, built up as the teacher speaks. Rules for a scene:
  · content is one self-contained <svg viewBox="0 0 640 360"> on a white board: thick strokes (stroke-width 4-6), big labels (font-size 24-30, font-family sans-serif), clear colours (#e63946 red, #2a9d8f teal, #3a86ff blue, #f4a261 orange, #8338ec purple, #2b2d42 ink), no scripts, no external images, at most 2,500 characters.
  · Draw the base picture first (no data-step), then wrap each addition in <g data-step="1">, <g data-step="2"> … in the order the teacher mentions them: the parallel lines, then the transversal, then the pair of angles with their arcs and labels; the cell outline, then the membrane, then the nucleus; the axes, then the line, then the point being read. 3 to 6 steps. Each step adds the element AND its label (a letter, a name, a value).
  · cues: for every step, the exact 2-6 words from "say" (copied verbatim, same language) at which that step should appear. Say the name of the thing as you draw it, so the words and the picture meet.
  · Angles: draw the arc; equal angles get the same colour. Graphs: label axes and units. Processes: arrows in the direction of flow. Arabic scenes: Arabic labels, digits as in Egyptian textbooks.
- Use "svg" only for a tiny static icon, "steps" for procedures, "formula" for one formula, "table" for comparisons.
- Checks test the idea just taught. Hints do not give the answer away.
- The teacher is animated: give each beat a gesture and a mood that fit (wave for the hook, point or write when the board carries content, think for checks, celebrate for the recap; surprised for a twist, encourage after a hard idea).
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
    max_tokens: 20000,
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
