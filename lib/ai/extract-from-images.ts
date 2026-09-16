import Anthropic from "@anthropic-ai/sdk";
import { modelFor } from "./models";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractedItemSchema } from "./extract-items";

export type ImageInput = { media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string };

const ItemsSchema = z.object({
  items: z.array(ExtractedItemSchema),
  summary: z.string(),
});

const ITEMS_SYSTEM = `You read photos and screenshots shared in a school class WhatsApp group (American-curriculum international school in Egypt; text may be English, Arabic, or both). Extract every actionable item for one student: homework, quizzes, exams, projects, events (trips, sports days, championships, things to bring, supply lists as a single "event" item). Use "note" for important information that is not a task (rules, schedule changes).

Rules:
- Resolve dates against today's date given by the user. The Egyptian school week is Sunday to Thursday.
- Write titles and details in English; keep Arabic names of things in parentheses when useful.
- One item per task. Never invent dates: if a date is not visible, set due_date to null and confidence to "low".
- source_excerpt: quote the visible text you relied on (transliterate Arabic if needed).`;

export async function extractItemsFromImages(images: ImageInput[], today: string): Promise<z.infer<typeof ItemsSchema>> {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: modelFor("extract"),
    max_tokens: 16000,
    system: [{ type: "text", text: ITEMS_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.media_type, data: img.data } })),
          { type: "text", text: `Today is ${today}. Extract the items from these ${images.length} image(s).` },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ItemsSchema) },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to read these images.");
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  return ItemsSchema.parse(JSON.parse(text));
}

export const TimetableEntrySchema = z.object({
  weekday: z.number().int().min(0).max(6).describe("0 = Sunday, 1 = Monday, ... 6 = Saturday"),
  start_time: z.string().describe("HH:MM, 24-hour"),
  end_time: z.string().describe("HH:MM, 24-hour"),
  subject_name: z.string(),
  teacher: z.string().nullable(),
});
const TimetableSchema = z.object({
  grade: z.number().int().nullable(),
  entries: z.array(TimetableEntrySchema),
});
export type ExtractedTimetableEntry = z.infer<typeof TimetableEntrySchema>;

const TT_SYSTEM = `You read a photo of a weekly school timetable and return every lesson as an entry.

Rules:
- Read the period times from the header row. Afternoon times like 1:25 are 13:25 in 24-hour form.
- When one subject spans several consecutive periods, return ONE entry from the first period's start to the last period's end.
- Skip breaks and empty cells. Skip a whole day if it has no lessons.
- weekday: Sunday = 0, Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4.
- subject_name is the subject as written (e.g. "English SAT", "Math (GPA)"); teacher is the name written under it, or null.`;

export async function extractTimetableFromImage(image: ImageInput): Promise<z.infer<typeof TimetableSchema>> {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: modelFor("extract"),
    max_tokens: 16000,
    system: [{ type: "text", text: TT_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } },
          { type: "text", text: "Extract the timetable." },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(TimetableSchema) },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to read this image.");
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  return TimetableSchema.parse(JSON.parse(text));
}
