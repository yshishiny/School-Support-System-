"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HERO_BUCKET } from "@/lib/hero";

const PATHS = ["/today", "/me", "/learn", "/coach", "/parent/children", "/parent"];

/** After the browser uploaded to Storage, record the picture. Parents may add for any child; a child only for himself. */
export async function registerHeroImageAction(studentId: string, path: string, caption: string): Promise<{ error?: string; id?: string }> {
  const { profile, family } = await requireSession();
  if (!path.startsWith(`${family.id}/${studentId}/`)) return { error: "Bad upload path." };
  if (profile.role !== "parent" && profile.id !== studentId) return { error: "Not allowed." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("hero_images").insert({ student_id: studentId, family_id: family.id, path, caption: caption.trim().slice(0, 120) || null, uploaded_by: profile.id }).select("id").single();
  if (error || !data) return { error: error?.message ?? "Could not save." };
  // First picture becomes the avatar and banner automatically so it shows up immediately.
  const { data: p } = await supabase.from("profiles").select("avatar_image_id, banner_image_id").eq("id", studentId).single();
  const patch: Record<string, string> = {};
  if (!p?.avatar_image_id) patch.avatar_image_id = data.id;
  if (!p?.banner_image_id) patch.banner_image_id = data.id;
  if (Object.keys(patch).length) await supabase.from("profiles").update(patch).eq("id", studentId);
  PATHS.forEach((x) => revalidatePath(x));
  return { id: data.id };
}

export async function chooseHeroAction(kind: "avatar" | "banner", imageId: string | null): Promise<void> {
  const { profile } = await requireSession();
  const supabase = await createClient();
  await supabase.from("profiles").update(kind === "avatar" ? { avatar_image_id: imageId } : { banner_image_id: imageId }).eq("id", profile.id);
  PATHS.forEach((x) => revalidatePath(x));
}

export async function deleteHeroImageAction(imageId: string): Promise<void> {
  const { profile, family } = await requireSession();
  const admin = createAdminClient();
  const { data: img } = await admin.from("hero_images").select("id, path, student_id").eq("id", imageId).eq("family_id", family.id).maybeSingle();
  if (!img) return;
  if (profile.role !== "parent" && img.student_id !== profile.id) return;
  await admin.storage.from(HERO_BUCKET).remove([img.path]);
  await admin.from("hero_images").delete().eq("id", imageId);
  PATHS.forEach((x) => revalidatePath(x));
}

/** How the banner is framed on the home page: zoom and focal point (percent). */
export async function setBannerFramingAction(zoom: number, x: number, y: number): Promise<void> {
  const { profile } = await requireSession();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ banner_zoom: Math.max(1, Math.min(3, Math.round(zoom * 100) / 100)), banner_x: Math.max(0, Math.min(100, Math.round(x))), banner_y: Math.max(0, Math.min(100, Math.round(y))) })
    .eq("id", profile.id);
  PATHS.forEach((p) => revalidatePath(p));
}
