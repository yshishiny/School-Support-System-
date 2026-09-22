import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { modelFor } from "./models";
import { materialBlocks, type MaterialInput } from "./read-material";
import { readStructured } from "./finish";

/** The ceiling this step writes under, named so the failure can say which limit it hit. */
const WORKING_TOKENS = 8000;

/**
 * Reading a child's handwritten working and finding the first line that is wrong.
 *
 * The model has never seen a child's own work. It writes lessons blind and marks multiple choice, which tells you
 * whether he picked the right letter and nothing about where his method breaks. This is the other direction: he
 * photographs what he wrote, and is told **which line** went wrong.
 *
 * One rule shapes the whole prompt: **it does not give the answer.** The teaching model delegates the attempt to
 * the child and nothing else may take it from him — a hint costs him one more try, a solution costs him the
 * practice. The most useful thing an examiner ever says is "you were fine until line three".
 */
const LineSchema = z.object({
  text: z.string().describe("The line as written, transcribed. Keep his notation, do not tidy it"),
  status: z.enum(["ok", "wrong", "unclear"]).describe("'wrong' only for the line where the error is actually made, not the lines that inherit it"),
  note: z.string().nullable().describe("For a wrong line only: what the mistake is, in under fifteen words. Never the corrected line"),
});

const Schema = z.object({
  readable: z.boolean().describe("false when the photograph is too blurred, too dark or too far away to read"),
  problem: z.string().describe("The question he is working on, as far as it can be told. 'Unclear' if it is not on the page"),
  lines: z.array(LineSchema).describe("His working, line by line, in order"),
  first_wrong_line: z.number().int().nullable().describe("1-based index of the first wrong line, or null when the working is right"),
  correct: z.boolean().nullable().describe("Whether the final answer is right. null when there is no final answer or it cannot be read"),
  what_went_wrong: z.string().describe("One sentence to the child about the first mistake. Plain, not unkind, and never the corrected working"),
  hint: z.string().describe("What to try next, in one sentence. A nudge towards the method — never the answer, never the corrected line"),
});

export type WorkingCheck = z.infer<typeof Schema>;

const SYSTEM = `You are looking at a photograph of a school student's handwritten working on one problem, and finding where it first goes wrong.

What matters:
- Find the FIRST line that is actually wrong. Later lines that are only wrong because they inherit that error are "ok" — he made one mistake, not six. Telling a child every line is wrong when he made one slip is the fastest way to make him stop trying.
- Never write the corrected line, the next step, or the final answer. Not in any field. He is going to try again, and that is the point of him trying.
- "what_went_wrong" names the mistake: "you subtracted 7 from the left but added it on the right". "hint" points at the method: "check what you did to both sides".
- If the working is entirely correct, say so plainly and warmly. Do not invent a criticism.
- If you cannot read it, set readable false and say what would help — closer, flatter, more light — rather than guessing at the numbers.
- Transcribe what he actually wrote, including his mistakes. Do not silently fix his notation.
- Answer in the language he wrote in.`;

export async function checkWorking(
  photo: MaterialInput,
  ctx: { subject?: string | null; topic?: string | null; grade?: number | null; question?: string | null },
): Promise<WorkingCheck & { model: string }> {
  const client = new Anthropic();
  const model = modelFor("worksheet");
  const content: Anthropic.ContentBlockParam[] = materialBlocks(photo);
  content.push({
    type: "text",
    text: [
      ctx.grade ? `Grade ${ctx.grade}.` : "",
      ctx.subject ? `Subject: ${ctx.subject}.` : "",
      ctx.topic ? `Topic: ${ctx.topic}.` : "",
      ctx.question ? `The question he was set: ${ctx.question}` : "",
      "Find the first line that is wrong. Do not give him the answer.",
    ].filter(Boolean).join("\n"),
  });

  const stream = client.messages.stream({
    model,
    max_tokens: WORKING_TOKENS,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(Schema) },
  });
  const message = await stream.finalMessage();
  return { ...readStructured(message, Schema, "the check of this working", WORKING_TOKENS), model: message.model };
}
