import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { effortFor, modelFor } from "./models";
import { sanitizeSvg } from "@/lib/svg";

const Schema = z.object({
  visuals: z.array(z.object({
    title: z.string().describe("Short title of the diagram"),
    caption: z.string().describe("One or two sentences telling the student what to look at"),
    svg: z.string().describe("A complete, self-contained <svg> with viewBox 0 0 640 360, no scripts, no external images, readable text at 14-20px"),
  })).describe("Two or three figures"),
  video_query: z.string().describe("The best 3-6 word search phrase for a video lesson on this exact topic, in the lesson language"),
});
export type TopicVisuals = z.infer<typeof Schema>;

const SYSTEM = `You draw teaching diagrams for a student at an American-curriculum school in Egypt. Produce 2 or 3 clean SVG figures that make the topic click at a glance: a labelled diagram, a number line or graph, a table of the key cases, a step-by-step flow, a cause→effect chain, or an annotated example. Rules for every SVG:
- viewBox="0 0 640 360", nothing outside it, white or very light background rectangle first.
- Only shapes, lines, paths, text and simple gradients. No <script>, <image>, <foreignObject>, links or animation.
- Use 3-4 friendly colours with strong contrast; text in a plain sans-serif at 14-20px; keep labels short so nothing overlaps.
- Everything must be correct: check numbers, arrows and labels twice. Prefer a simpler figure over a wrong one.
- For Arabic lessons write the labels in Arabic (direction="rtl" on text elements).
Return the video search phrase too.`;

export async function drawTopicVisuals(spec: { subject: string; unit: string | null; topic: string; grade: number | null; language: "en" | "ar"; lessonExcerpt?: string | null }): Promise<{ visuals: { title: string; caption: string; svg: string }[]; videoQuery: string; model: string }> {
  const client = new Anthropic();
  const res = await client.messages.parse({
    model: modelFor("explain"),
    max_tokens: 12000,
    output_config: { ...effortFor("explain", "medium"), format: zodOutputFormat(Schema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [`Grade ${spec.grade ?? ""}`, `Subject: ${spec.subject}`, spec.unit ? `Unit: ${spec.unit}` : "", `Topic: ${spec.topic}`, spec.language === "ar" ? "Language: Arabic" : "Language: English", spec.lessonExcerpt ? `The lesson text starts:\n${spec.lessonExcerpt.slice(0, 1500)}` : ""].filter(Boolean).join("\n") }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("The model declined to draw this topic.");
  const visuals = res.parsed_output.visuals.slice(0, 3).map((v) => ({ title: v.title, caption: v.caption, svg: sanitizeSvg(v.svg) })).filter((v): v is { title: string; caption: string; svg: string } => !!v.svg);
  return { visuals, videoQuery: res.parsed_output.video_query, model: res.model };
}
