import { report } from "@/lib/ops/fault";

/**
 * Hearing what a child recited.
 *
 * The same Azure Speech resource that already reads lessons aloud also transcribes, so this needs no new vendor,
 * no new key and no new bill — `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` are already set for the voices.
 *
 * The fast-transcription endpoint is used rather than the short-audio one because it accepts the containers a
 * phone actually produces: Chrome on Android records `audio/webm;codecs=opus`, Safari records `audio/mp4`, and
 * the older endpoint takes neither without conversion.
 */
export function sttEnabled(): boolean {
  return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

export interface Heard {
  text: string;
  /** Azure's own confidence, 0-1, when it gives one. Low confidence is shown to the child, never hidden. */
  confidence: number | null;
  seconds: number | null;
}

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * `locale` should be the one the child is reciting in — `ar-EG` for Arabic. Quranic Arabic is closer to MSA than
 * to Egyptian, so classical recitation is sent as `ar-SA`, which is what the recogniser is actually trained on.
 */
export async function transcribe(audio: Blob, locale: string): Promise<Heard | { error: string }> {
  if (!sttEnabled()) return { error: "Speech is not set up on the server." };
  if (audio.size === 0) return { error: "Nothing was recorded." };
  if (audio.size > MAX_BYTES) return { error: "That recording is too long. Try one ayah at a time." };

  const region = process.env.AZURE_SPEECH_REGION!;
  const url = `https://${region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`;

  const form = new FormData();
  form.append("audio", audio, "recitation");
  form.append("definition", JSON.stringify({ locales: [locale], profanityFilterMode: "None" }));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY! },
      body: form,
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      const ref = await report("stt.transcribe", new Error(`Azure ${res.status}: ${detail}`), { meta: { locale, bytes: audio.size } });
      // The child is told it did not work, not why. The reference is for whoever looks at the log.
      return { error: `The recording could not be heard (ref ${ref}).` };
    }
    const body = (await res.json()) as {
      duration?: number;
      combinedPhrases?: { text?: string }[];
      phrases?: { text?: string; confidence?: number }[];
    };
    const text = body.combinedPhrases?.map((p) => p.text ?? "").join(" ").trim()
      ?? body.phrases?.map((p) => p.text ?? "").join(" ").trim()
      ?? "";
    const confidences = (body.phrases ?? []).map((p) => p.confidence).filter((c): c is number => typeof c === "number");
    return {
      text,
      confidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null,
      seconds: typeof body.duration === "number" ? Math.round(body.duration / 1000) : null,
    };
  } catch (err) {
    const ref = await report("stt.transcribe", err, { meta: { locale, bytes: audio.size } });
    return { error: `The recording could not be sent (ref ${ref}).` };
  }
}
