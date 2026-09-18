"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { characterById } from "@/lib/characters";
import { PRESENTER_BUCKET } from "@/lib/video";

/** A presenter photo for a character: a clear, front-facing face on a plain background works best. */
export async function uploadPresenterAction(characterId: string, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const c = characterById(characterId);
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
  if (file.size > 5 * 1024 * 1024) return { error: "Photo too large (5 MB max)." };
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${c.id}-${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(PRESENTER_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "image/jpeg", upsert: true });
  if (error) return { error: error.message };
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
