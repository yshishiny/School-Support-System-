import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHARACTERS, type Character } from "@/lib/characters";
import { CLOUD_VOICES, defaultCloudVoice } from "@/lib/tts";

/**
 * Video presenters: each scripted line becomes a short clip of a realistic human presenter, lip-synced to the
 * premium voice, rendered by D-ID from a presenter photo. Clips are rendered once per line, presenter and voice
 * and kept in the private `lesson-videos` bucket; a monthly cap on new clips keeps the bill in hand.
 * Env: DID_API_KEY (D-ID Studio → API key). Photos live in the public `presenters` bucket, chosen under Admin → Teachers.
 */
export const PRESENTER_BUCKET = "presenters";
export const VIDEO_BUCKET = "lesson-videos";
const DEFAULT_CAP = 500;
const MAX_CHARS = 1200;
const DID = "https://api.d-id.com";
/** D-ID's own sample presenter, used until a photo is chosen for a character. */
const SAMPLE_PRESENTER = "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg";

export type VideoAnswer = { status: "done"; url: string; seconds: number | null } | { status: "pending" } | { status: "off"; reason: string } | { status: "error"; reason: string };

export function videoEnabled(): boolean {
  return !!process.env.DID_API_KEY;
}

function authHeader(): string {
  const key = process.env.DID_API_KEY ?? "";
  return `Basic ${key.includes(":") ? Buffer.from(key).toString("base64") : key}`;
}

/** The presenter photo per character, from settings; the sample face until one is uploaded. */
export async function presenterUrls(): Promise<Record<string, { url: string; custom: boolean }>> {
  const admin = createAdminClient();
  const { data } = await admin.from("ops_settings").select("key, value").like("key", "presenter:%");
  const out: Record<string, { url: string; custom: boolean }> = {};
  for (const c of CHARACTERS) {
    const path = (data ?? []).find((r) => r.key === `presenter:${c.id}`)?.value;
    out[c.id] = path ? { url: admin.storage.from(PRESENTER_BUCKET).getPublicUrl(path).data.publicUrl, custom: true } : { url: SAMPLE_PRESENTER, custom: false };
  }
  return out;
}

export type VideoMode = "hook_recap" | "all";
export type BeatKind = "hook" | "explain" | "example" | "check" | "recap";

/** Which lines get a presenter clip: the personal moments only (default, about 70% cheaper) or every line. */
export async function videoMode(): Promise<VideoMode> {
  const admin = createAdminClient();
  const { data } = await admin.from("ops_settings").select("value").eq("key", "video_mode").maybeSingle();
  return data?.value === "all" ? "all" : "hook_recap";
}

export function videoKinds(mode: VideoMode): BeatKind[] {
  return mode === "all" ? ["hook", "explain", "example", "check", "recap"] : ["hook", "recap"];
}

export async function videoCap(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.from("ops_settings").select("value").eq("key", "video_cap").maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CAP;
}

export async function videoMonthCount(): Promise<number> {
  const admin = createAdminClient();
  const start = new Date();
  start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const { count } = await admin.from("lesson_videos").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString()).neq("status", "error");
  return count ?? 0;
}

/** The voice a presenter speaks with: the chosen premium voice, else the character's default. */
export function videoVoice(c: Character, language: "en" | "ar", chosen?: string | null): string | null {
  if (chosen && CLOUD_VOICES.some((v) => v.id === chosen && v.lang.startsWith(language))) return chosen;
  return defaultCloudVoice(c, language)?.id ?? null;
}

function clipId(characterId: string, presenter: string, voice: string, text: string): string {
  return createHash("sha256").update(`${characterId}|${presenter}|${voice}|${text}`).digest("hex").slice(0, 40);
}

async function createTalk(presenter: string, voice: string, text: string): Promise<string> {
  const res = await fetch(`${DID}/talks`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ source_url: presenter, script: { type: "text", input: text, provider: { type: "microsoft", voice_id: voice }, ssml: false }, config: { fluent: true, pad_audio: 0, stitch: true, result_format: "mp4" } }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; description?: string; kind?: string };
  if (!res.ok || !body.id) throw new Error(body.description ?? body.kind ?? `The video service answered ${res.status}.`);
  return body.id;
}

async function pollTalk(talkId: string): Promise<{ status: string; result_url?: string; duration?: number; error?: { description?: string } }> {
  const res = await fetch(`${DID}/talks/${talkId}`, { headers: { Authorization: authHeader(), Accept: "application/json" } });
  if (!res.ok) throw new Error(`The video service answered ${res.status}.`);
  return (await res.json()) as { status: string; result_url?: string; duration?: number; error?: { description?: string } };
}

/**
 * A clip for one line: returns it when rendered, starts it when new (within the cap), and while it renders says so.
 * The stage plays the animated teacher with the voice in the meantime, so the lesson never waits on this.
 */
export async function requestClip(o: { characterId: string; voice: string; text: string; create?: boolean; kind?: string | null }): Promise<VideoAnswer> {
  if (!videoEnabled()) return { status: "off", reason: "not configured" };
  const text = o.text.trim().slice(0, MAX_CHARS);
  if (!text) return { status: "error", reason: "nothing to say" };
  if (o.create !== false && o.kind && !videoKinds(await videoMode()).includes(o.kind as BeatKind)) o.create = false;
  const presenters = await presenterUrls();
  const presenter = presenters[o.characterId]?.url ?? SAMPLE_PRESENTER;
  const id = clipId(o.characterId, presenter, o.voice, text);
  const admin = createAdminClient();
  const { data: row } = await admin.from("lesson_videos").select("*").eq("id", id).maybeSingle();

  if (row?.status === "done" && row.path) {
    const { data } = await admin.storage.from(VIDEO_BUCKET).createSignedUrl(row.path, 3600);
    if (data?.signedUrl) return { status: "done", url: data.signedUrl, seconds: row.seconds == null ? null : Number(row.seconds) };
  }
  if (row?.status === "pending" && row.talk_id) {
    const r = await finalizeTalk({ id, characterId: o.characterId, talkId: row.talk_id });
    if (r.status === "done") {
      const { data } = await admin.storage.from(VIDEO_BUCKET).createSignedUrl(r.path, 3600);
      if (data?.signedUrl) return { status: "done", url: data.signedUrl, seconds: r.seconds };
      return { status: "pending" };
    }
    return r;
  }
  if (row?.status === "error") {
    // A failed render is retried once a day, not on every play.
    if (Date.now() - new Date(row.created_at).getTime() < 86_400_000) return { status: "error", reason: row.error ?? "render failed" };
    await admin.from("lesson_videos").delete().eq("id", id);
  }
  if (o.create === false) return { status: "off", reason: "not rendered" };
  const [cap, used] = await Promise.all([videoCap(), videoMonthCount()]);
  if (used >= cap) return { status: "off", reason: `monthly cap of ${cap} clips reached` };
  try {
    const talkId = await createTalk(presenter, o.voice, text);
    await admin.from("lesson_videos").upsert({ id, character_id: o.characterId, voice: o.voice, status: "pending", talk_id: talkId, created_at: new Date().toISOString() });
    return { status: "pending" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "could not start the render";
    await admin.from("lesson_videos").upsert({ id, character_id: o.characterId, voice: o.voice, status: "error", error: reason, created_at: new Date().toISOString() });
    return { status: "error", reason };
  }
}

/** Asks D-ID about one pending render; stores the clip when it is done, the reason when it failed. */
async function finalizeTalk(o: { id: string; characterId: string; talkId: string }): Promise<{ status: "done"; path: string; seconds: number | null } | { status: "pending" } | { status: "error"; reason: string }> {
  const admin = createAdminClient();
  try {
    const t = await pollTalk(o.talkId);
    if (t.status === "done" && t.result_url) {
      const file = await fetch(t.result_url);
      if (!file.ok) throw new Error("Could not download the clip.");
      const bytes = Buffer.from(await file.arrayBuffer());
      const path = `${o.characterId}/${o.id}.mp4`;
      const { error } = await admin.storage.from(VIDEO_BUCKET).upload(path, bytes, { contentType: "video/mp4", upsert: true });
      if (error) throw new Error(error.message);
      await admin.from("lesson_videos").update({ status: "done", path, seconds: t.duration ?? null, done_at: new Date().toISOString() }).eq("id", o.id);
      return { status: "done", path, seconds: t.duration ?? null };
    }
    if (t.status === "error" || t.status === "rejected") {
      const reason = t.error?.description ?? t.status;
      await admin.from("lesson_videos").update({ status: "error", error: reason }).eq("id", o.id);
      return { status: "error", reason };
    }
    return { status: "pending" };
  } catch (err) {
    return { status: "error", reason: err instanceof Error ? err.message : "poll failed" };
  }
}

/** Checks on renders still marked pending (oldest first) and stores what finished. For the admin button and jobs. */
export async function syncPendingClips(limit = 30): Promise<{ checked: number; done: number; pending: number; failed: number; errors: string[] }> {
  const admin = createAdminClient();
  const { data: rows } = await admin.from("lesson_videos").select("id, character_id, talk_id").eq("status", "pending").not("talk_id", "is", null).order("created_at").limit(limit);
  const out = { checked: 0, done: 0, pending: 0, failed: 0, errors: [] as string[] };
  for (const r of rows ?? []) {
    out.checked += 1;
    const res = await finalizeTalk({ id: r.id, characterId: r.character_id, talkId: r.talk_id as string });
    if (res.status === "done") out.done += 1;
    else if (res.status === "pending") out.pending += 1;
    else { out.failed += 1; if (out.errors.length < 3 && !out.errors.includes(res.reason)) out.errors.push(res.reason); }
  }
  return out;
}

/** Counts by status plus the latest failure reasons, for the admin page. */
export async function clipStats(): Promise<{ done: number; pending: number; failed: number; errors: string[] }> {
  const admin = createAdminClient();
  const [{ data: rows }, { data: errs }] = await Promise.all([
    admin.from("lesson_videos").select("status"),
    admin.from("lesson_videos").select("error").eq("status", "error").order("created_at", { ascending: false }).limit(3),
  ]);
  const n = (s: string) => (rows ?? []).filter((r) => r.status === s).length;
  return { done: n("done"), pending: n("pending"), failed: n("error"), errors: [...new Set((errs ?? []).map((e) => e.error).filter((x): x is string => !!x))] };
}

/** Starts the script's video lines rendering, in order, so the clips are ready by the time the child reaches them. */
export async function renderScript(o: { characterId: string; voice: string; beats: { kind: string; say: string }[] }): Promise<void> {
  const kinds = videoKinds(await videoMode());
  for (const b of o.beats) {
    if (!kinds.includes(b.kind as BeatKind)) continue;
    try { await requestClip({ characterId: o.characterId, voice: o.voice, text: b.say }); } catch { /* next line */ }
  }
}
