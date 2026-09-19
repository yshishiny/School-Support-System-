import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { effortFor, modelFor } from "./models";
import { sanitizeSvg } from "@/lib/svg";

/**
 * The illustrator: draws one lesson scene from the writer's brief, to a fixed professional style, as a layered SVG
 * whose steps appear on the teacher's cues. Runs once per scene when a script is written; the drawing is cached with it.
 */
const OutSchema = z.object({
  svg: z.string().describe("The complete <svg> element, at most 6000 characters"),
  cues: z.array(z.object({ phrase: z.string(), step: z.number().int().min(1).max(8) })).describe("One per data-step group, in order; phrase copied verbatim from the spoken line"),
});
export type Illustration = z.infer<typeof OutSchema>;

const SYSTEM = `You are a professional educational illustrator. You draw ONE scene for a spoken school lesson as a clean, layered SVG that is built up step by step while a teacher speaks. Children aged 11-15 watch it on a phone or laptop.

CANVAS: <svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" font-family="Nunito, Arial, sans-serif">. Background: a soft panel (rect 0 0 640 360, fill #f7f9fc) plus, where it helps, a faint grid or ground line. Nothing outside the canvas.

STYLE (textbook illustration, not a sketch):
- Objects have a fill, a 3px darker outline of the same hue, and depth from a subtle linear gradient (<defs><linearGradient>) or a soft shadow (<filter id="s"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".25"/></filter>).
- Palette: red #e63946, teal #2a9d8f, blue #3a86ff, orange #f4a261, purple #8338ec, green #52b788, yellow #ffd166, ink #1f2430, grey #8d99ae. Equal things share a colour (equal angles, matching sides, paired forces).
- Lines: stroke-width 5 for main lines, 3 for construction lines (dashed 8 4), arrowheads with <marker>. Angles: a filled arc (path) plus its letter. Graphs: axes with arrowheads, ticks, unit labels, a light grid.
- TEXT: fill #1f2430 (never white, never light), font-weight 700, font-size 26-30 for names and letters, 22 for values and notes; add stroke="#ffffff" stroke-width="5" paint-order="stroke" on every text so it stays readable over anything. A label sits next to its object with a short leader line when needed.
- SPACING: keep at least 28px between any two labels and 16px between a label and any other shape; never overlap. Reserve the right third (x 430-620) or the bottom strip (y 300-350) for labels and results when the drawing is busy. Objects added in later steps go into free space, never on top of earlier ones.
- LAYERS AND STEPS: draw the base first (the things present from the start, no data-step). Then each addition the teacher names, in the order named, inside <g data-step="1">, <g data-step="2"> ... (3 to 6 groups). A step adds the element AND its label. Later groups may include a small "result" box (rounded rect #fff3cd stroke #f4a261) with the conclusion.
- Content must be faithful to the subject: correct geometry (parallel lines truly parallel, right angles square, proportions plausible), correct biology/physics/geography, correct Arabic labels for Arabic lessons (the digits as in Egyptian textbooks). Never invent facts beyond the brief.
- No scripts, no external images, no foreignObject, no animation elements. At most 6000 characters.

CUES: for each step, copy 2-6 consecutive words exactly as they appear in the spoken line (same language, same letters) at which that step should appear. If the spoken line does not name a step, choose the nearest words that lead into it.`;

export async function illustrateScene(o: { subject: string; topic: string; language: "en" | "ar"; say: string; brief: string; existingCues?: { phrase: string; step: number }[] | null }): Promise<Illustration | null> {
  const client = new Anthropic();
  const user = [
    `Subject: ${o.subject} · Topic: ${o.topic} · Language of labels: ${o.language === "ar" ? "Arabic" : "English"}`,
    `SPOKEN LINE (the teacher says this while the scene builds):\n"""${o.say}"""`,
    `BRIEF (what to draw and in which order):\n${o.brief}`,
    o.existingCues?.length ? `Suggested cue phrases: ${o.existingCues.map((c) => `step ${c.step}: "${c.phrase}"`).join("; ")}` : "",
  ].filter(Boolean).join("\n\n");
  try {
    const res = await client.messages.create({
      model: modelFor("illustrate"),
      max_tokens: 9000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(OutSchema), ...effortFor("illustrate", "medium") },
    });
    if (res.stop_reason === "refusal") return null;
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const out = OutSchema.parse(JSON.parse(text));
    const svg = sanitizeSvg(out.svg);
    if (!svg || !/data-step=/.test(svg)) return null;
    return { svg, cues: out.cues };
  } catch {
    return null;
  }
}
