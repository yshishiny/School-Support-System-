"use server";

import { revalidatePath } from "next/cache";
import { failed } from "@/lib/ops/fault";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { characterById } from "@/lib/characters";
import { PRESENTER_BUCKET, syncPendingClips } from "@/lib/video";

/** Asks the video service about every clip still rendering and stores the finished ones. */
export async function syncClipsAction(): Promise<{ error?: string; summary?: string }> {
  await requireAdmin();
  if (!process.env.DID_API_KEY) return { error: "DID_API_KEY is not set." };
  const r = await syncPendingClips(40);
  revalidatePath("/parent/admin");
  return { summary: `Checked ${r.checked}: ${r.done} ready, ${r.pending} still rendering, ${r.failed} failed${r.errors.length ? ` — ${r.errors.join(" · ")}` : ""}.` };
}

/** A presenter photo for a character: a clear, front-facing face on a plain background works best. */
export async function uploadPresenterAction(characterId: string, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const c = characterById(characterId);
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
  if (file.size > 5 * 1024 * 1024) return { error: `Photo is ${(file.size / 1048576).toFixed(1)} MB; the limit is 5 MB. The page shrinks photos before sending, so this one could not be read by the browser: try a JPG or PNG export of it.` };
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { error: `Photo type "${file.type || "unknown"}" is not accepted: use JPG, PNG or WebP.` };
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${c.id}-${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(PRESENTER_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "image/jpeg", upsert: true });
  if (error) return failed("actions.ops-video.uploadPresenter", error);
  await admin.from("ops_settings").upsert({ key: `presenter:${c.id}`, value: path, updated_at: new Date().toISOString() });
  revalidatePath("/parent/admin");
  return { ok: true };
}

export async function clearPresenterAction(characterId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("ops_settings").delete().eq("key", `presenter:${characterById(characterId).id}`);
  revalidatePath("/parent/admin");
}

/** Forgets failed renders (out of credits, a rejected photo) so the next lesson play asks for them again. */
export async function retryFailedClipsAction(): Promise<{ summary: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("lesson_videos").delete().eq("status", "error").select("id");
  revalidatePath("/parent/admin");
  return { summary: `${data?.length ?? 0} failed clip${(data?.length ?? 0) === 1 ? "" : "s"} will be rendered again on the next play.` };
}

/** The voice gender for a presenter photo: a woman's face speaks with a woman's voice whatever the character's default. */
export async function setPresenterGenderAction(characterId: string, gender: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const key = `presenter_gender:${characterById(characterId).id}`;
  if (gender === "m" || gender === "f") await admin.from("ops_settings").upsert({ key, value: gender, updated_at: new Date().toISOString() });
  else await admin.from("ops_settings").delete().eq("key", key);
  revalidatePath("/parent/admin");
}

/** Which lines get video: the hook and recap only (default) or every line. */
export async function setVideoModeAction(mode: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("ops_settings").upsert({ key: "video_mode", value: mode === "all" ? "all" : "hook_recap", updated_at: new Date().toISOString() });
  revalidatePath("/parent/admin");
}

/** The monthly ceiling on new clips (each is one spoken line, about 20-40 seconds). */
export async function setVideoCapAction(form: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const n = Number(form.get("cap"));
  if (!Number.isFinite(n) || n < 0 || n > 100000) return { error: "Enter a number of clips." };
  const admin = createAdminClient();
  await admin.from("ops_settings").upsert({ key: "video_cap", value: String(Math.round(n)), updated_at: new Date().toISOString() });
  revalidatePath("/parent/admin");
  return { ok: true };
}
