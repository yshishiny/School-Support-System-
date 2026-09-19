import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { effortFor, modelFor } from "@/lib/ai/models";
import { speakable } from "./speakable";

const ARABIC = /[؀-ۿ]/g;
const HARAKAT = /[ً-ْٰ]/g;

/** An Arabic line whose vowels are mostly missing: the voice would guess them. */
export function needsTashkeel(text: string): boolean {
  const letters = (text.match(ARABIC) ?? []).length;
  if (letters < 6) return false;
  const marks = (text.match(HARAKAT) ?? []).length;
  return marks / letters < 0.2;
}

const SYSTEM = "You add full Arabic diacritics (تشكيل كامل) to text that will be read aloud by a text-to-speech voice. Return the same text with every word fully vowelled, including the final vowel (إعراب), in Modern Standard Arabic. Change nothing else: no words added, removed, reordered or replaced; keep punctuation, digits and Latin letters exactly. Output only the vowelled text.";

/** The line as the voice should read it: Arabic fully vowelled (cached per line), then symbols turned into words. */
export async function spokenText(text: string, language: "en" | "ar"): Promise<string> {
  let s = text;
  if (language === "ar" && needsTashkeel(s) && process.env.ANTHROPIC_API_KEY) s = await vocalize(s).catch(() => s);
  return speakable(s, language);
}

async function vocalize(text: string): Promise<string> {
  const id = createHash("sha256").update(`ar|${text}`).digest("hex").slice(0, 40);
  const admin = createAdminClient();
  const { data } = await admin.from("spoken_lines").select("spoken").eq("id", id).maybeSingle();
  if (data?.spoken) return data.spoken;
  const client = new Anthropic();
  const res = await client.messages.create({
    model: modelFor("vocalize"),
    max_tokens: 1500,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: text }],
    output_config: { ...effortFor("vocalize", "low") },
  });
  const out = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
  // Guard: the same words must come back, only with marks added.
  const strip = (t: string) => t.replace(HARAKAT, "").replace(/\s+/g, " ").trim();
  if (!out || strip(out) !== strip(text)) return text;
  await admin.from("spoken_lines").upsert({ id, language: "ar", text, spoken: out }).then(() => null, () => null);
  return out;
}
