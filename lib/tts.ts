import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Character } from "@/lib/characters";

/**
 * Premium voices: Microsoft Azure neural text-to-speech, the one service with true Egyptian Arabic voices.
 * Env: AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (Azure portal → Speech resource → Keys and Endpoint).
 * Free tier: 500,000 characters a month (about 50 lessons); paid: about US$16 per million characters.
 * Every line is cached as MP3 in the private `tts` bucket, so a script is synthesised once for both children.
 */
export interface CloudVoice { id: string; name: string; lang: string; gender: "m" | "f"; egyptian?: boolean }

export const CLOUD_VOICES: CloudVoice[] = [
  { id: "ar-EG-SalmaNeural", name: "Salma", lang: "ar-EG", gender: "f", egyptian: true },
  { id: "ar-EG-ShakirNeural", name: "Shakir", lang: "ar-EG", gender: "m", egyptian: true },
  { id: "en-US-GuyNeural", name: "Guy", lang: "en-US", gender: "m" },
  { id: "en-US-DavisNeural", name: "Davis", lang: "en-US", gender: "m" },
  { id: "en-US-JennyNeural", name: "Jenny", lang: "en-US", gender: "f" },
  { id: "en-US-AriaNeural", name: "Aria", lang: "en-US", gender: "f" },
  { id: "en-GB-RyanNeural", name: "Ryan", lang: "en-GB", gender: "m" },
  { id: "en-GB-SoniaNeural", name: "Sonia", lang: "en-GB", gender: "f" },
];

export const TTS_BUCKET = "tts";
const MAX_CHARS = 1200;

export function cloudVoicesEnabled(): boolean {
  return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

/** The premium voices offered for a lesson's language, or none when the service is not configured. */
export function cloudVoiceList(language: "en" | "ar"): CloudVoice[] {
  if (!cloudVoicesEnabled()) return [];
  return CLOUD_VOICES.filter((v) => v.lang.startsWith(language));
}

/** The character's default premium voice: by gender (the presenter's, when set), Egyptian for Arabic. */
export function defaultCloudVoice(c: Character, language: "en" | "ar", gender?: "m" | "f" | null): CloudVoice | null {
  const list = cloudVoiceList(language);
  const g = gender ?? (c.voice.preferFemale ? "f" : "m");
  return list.find((v) => v.gender === g) ?? list[0] ?? null;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[ch] ?? ch);
}

/** MP3 bytes for a line in a premium voice; from the cache when the same line was said before. */
export async function synthesize(o: { text: string; voice: string; rate: number; pitch: number }): Promise<Buffer> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error("Premium voices are not configured (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION).");
  const voice = CLOUD_VOICES.find((v) => v.id === o.voice);
  if (!voice) throw new Error("Unknown voice.");
  const text = o.text.trim().slice(0, MAX_CHARS);
  if (!text) throw new Error("Nothing to say.");
  const ratePct = Math.round((Math.min(1.3, Math.max(0.7, o.rate)) - 1) * 100);
  // Neural voices sound unnatural when their pitch is shifted; the character's manner comes from the words and the rate.
  const pitchPct = 0;
  void o.pitch;
  const hash = createHash("sha256").update(`${voice.id}|${ratePct}|${pitchPct}|${text}`).digest("hex").slice(0, 40);
  const path = `${voice.id}/${hash}.mp3`;
  const admin = createAdminClient();
  const cached = await admin.storage.from(TTS_BUCKET).download(path).catch(() => ({ data: null }));
  if (cached.data) return Buffer.from(await cached.data.arrayBuffer());

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice.lang}"><voice name="${voice.id}"><prosody rate="${ratePct >= 0 ? "+" : ""}${ratePct}%" pitch="${pitchPct >= 0 ? "+" : ""}${pitchPct}%">${escapeXml(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "study-portal" },
    body: ssml,
  });
  if (!res.ok) throw new Error(`The voice service answered ${res.status}${res.status === 401 ? " (check the key and region)" : ""}.`);
  const audio = Buffer.from(await res.arrayBuffer());
  void admin.storage.from(TTS_BUCKET).upload(path, audio, { contentType: "audio/mpeg", upsert: true }).catch(() => null);
  return audio;
}
