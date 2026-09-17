import Anthropic from "@anthropic-ai/sdk";
import { modelFor } from "./models";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ImageInput } from "./extract-from-images";
import type { SnapKind } from "@/lib/snaps";

const PhotoSchema = z.object({
  verdict: z.enum(["looks_good", "unclear", "not_it", "people"]),
  score: z.number().min(0).max(1).describe("How plausible it is that the task was done as described"),
  note: z.string().describe("One short sentence for the parent: what you see and why the verdict"),
  kid_note: z.string().describe("One friendly sentence for the child (a compliment or one concrete thing to fix)"),
});
const HomeworkSchema = PhotoSchema.extend({
  subject_guess: z.string().nullable(),
  matches_today: z.boolean().nullable().describe("Whether the page matches one of today's subjects, or null if today's subjects were not given"),
  filled_fraction: z.number().min(0).max(1).describe("How much of the page is written on"),
  handwritten: z.boolean(),
});
const HandwritingSchema = PhotoSchema.extend({
  language: z.enum(["english", "arabic", "mixed", "unknown"]),
  legibility: z.number().int().min(1).max(5),
  spacing: z.number().int().min(1).max(5),
  letter_formation: z.number().int().min(1).max(5),
  size_consistency: z.number().int().min(1).max(5),
  line_alignment: z.number().int().min(1).max(5),
  strengths: z.array(z.string()).describe("Up to three"),
  focus: z.array(z.string()).describe("The one to three things to work on, concrete (e.g. 'close the loops on a and d')"),
  practice_line: z.string().describe("A single sentence to copy five times next session, in the sample's language, using the letters that need work"),
});

const BagSchema = PhotoSchema.extend({
  subjects_seen: z.array(z.string()).describe("Subjects whose books or notebooks are visibly labelled, e.g. Math, Physics; empty if none readable"),
  matches_timetable: z.boolean().nullable().describe("Whether the visible books fit the next school day's subjects, or null if no subjects were given or none readable"),
});
const ScreenTimeSchema = PhotoSchema.extend({
  total_minutes: z.number().int().nullable().describe("Total screen time shown, in minutes; null if unreadable"),
  top_apps: z.array(z.object({ app: z.string(), minutes: z.number().int() })).describe("Up to 4 apps with the most time, as shown"),
  is_today: z.boolean().nullable().describe("Whether the screenshot shows today's summary (a 'Today' label or today's date), or null if unclear"),
});

export type PhotoCheck = z.infer<typeof PhotoSchema>;
export type BagCheck = z.infer<typeof BagSchema>;
export type ScreenTimeCheck = z.infer<typeof ScreenTimeSchema>;
export type HomeworkCheck = z.infer<typeof HomeworkSchema>;
export type HandwritingCheck = z.infer<typeof HandwritingSchema>;
export type SnapCheck = { kind: "photo"; result: PhotoCheck } | { kind: "homework"; result: HomeworkCheck } | { kind: "handwriting"; result: HandwritingCheck } | { kind: "bag"; result: BagCheck } | { kind: "screentime"; result: ScreenTimeCheck };

const SYSTEM = `You screen a photo a child (grade 8-10, Egypt) took to show a small daily win at home. A parent will look at it afterwards; you only give a first opinion.

Rules:
- Judge only what is visible. If the picture is too dark, blurry, or shows only a corner, say "unclear" rather than guessing.
- "not_it" when the picture clearly shows something else or the task clearly is not done.
- "people": if a person's face is visible, set this verdict and do not describe the person. Never describe people, clothing or bodies.
- Be kind and specific in kid_note; never sarcastic. In note for the parent be plain and short.
- Never claim the picture is old or reused; you cannot know that.`;

const HANDWRITING_SYSTEM = `You are a patient handwriting tutor for a teenager (grade 8-10). The photo is a handwriting sample in English or Arabic.
Score five aspects from 1 (needs a lot of work) to 5 (excellent for the age): legibility, spacing (between letters and words), letter formation (shapes, loops, joins; for Arabic also correct connected forms and dots), size consistency, and line alignment (sitting on the line).
Be concrete: name the letters or habits to fix. Pick strengths honestly. The practice line must be one natural sentence in the same language using the weak letters; keep it under 12 words. If the image is unreadable or shows a face, set verdict "unclear" or "people" and give neutral scores of 3.`;

function textOf(m: Anthropic.Message): string {
  return m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
}

/** One vision call per snap. Fast model: this runs while the child waits. */
export async function checkSnap(image: ImageInput, task: { kind: SnapKind; label: string; prompt: string | null }, ctx: { subjectsToday?: string[]; subjectsNext?: string[]; studentFirstName?: string; today?: string } = {}): Promise<SnapCheck> {
  const client = new Anthropic();
  const schema = task.kind === "handwriting" ? HandwritingSchema : task.kind === "homework" ? HomeworkSchema : task.kind === "bag" ? BagSchema : task.kind === "screentime" ? ScreenTimeSchema : PhotoSchema;
  const lines = [
    `Task: "${task.label}".`,
    task.prompt ? `What good looks like: ${task.prompt}` : "",
    ctx.subjectsToday?.length ? `Today's subjects at school: ${ctx.subjectsToday.join(", ")}.` : "",
    ctx.subjectsNext?.length ? `The next school day's subjects: ${ctx.subjectsNext.join(", ")}.` : "",
    ctx.today ? `Today's date: ${ctx.today}.` : "",
    task.kind === "screentime" ? "This is a screenshot of a phone's own screen-time summary, not a photo of a chore: 'looks_good' means the summary is readable and shows today; never judge the amount of time." : "",
    ctx.studentFirstName ? `The child's name is ${ctx.studentFirstName}.` : "",
  ].filter(Boolean);
  const stream = client.messages.stream({
    model: modelFor("snap"),
    max_tokens: 2000,
    system: [{ type: "text", text: task.kind === "handwriting" ? HANDWRITING_SYSTEM : SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } }, { type: "text", text: lines.join("\n") }] }],
    output_config: { format: zodOutputFormat(schema) },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to look at this picture.");
  const parsed = JSON.parse(textOf(message));
  if (task.kind === "handwriting") { const r = HandwritingSchema.parse(parsed); return { kind: "handwriting", result: { ...r, strengths: r.strengths.slice(0, 3), focus: r.focus.slice(0, 3) } }; }
  if (task.kind === "homework") return { kind: "homework", result: HomeworkSchema.parse(parsed) };
  if (task.kind === "bag") { const r = BagSchema.parse(parsed); return { kind: "bag", result: { ...r, subjects_seen: r.subjects_seen.slice(0, 8) } }; }
  if (task.kind === "screentime") { const r = ScreenTimeSchema.parse(parsed); return { kind: "screentime", result: { ...r, top_apps: r.top_apps.slice(0, 4) } }; }
  return { kind: "photo", result: PhotoSchema.parse(parsed) };
}
