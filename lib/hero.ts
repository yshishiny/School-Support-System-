import { createAdminClient } from "@/lib/supabase/admin";

export const HERO_BUCKET = "hero-images";

export interface HeroImage {
  id: string;
  student_id: string;
  path: string;
  caption: string | null;
  created_at: string;
}

/** Short-lived signed URLs for private hero pictures (one call for all). */
export async function signHeroUrls(images: { id: string; path: string }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (images.length === 0) return out;
  const admin = createAdminClient();
  const { data } = await admin.storage.from(HERO_BUCKET).createSignedUrls(images.map((i) => i.path), 3600);
  (data ?? []).forEach((d, k) => {
    if (d.signedUrl) out.set(images[k].id, d.signedUrl);
  });
  return out;
}

/** The avatar and banner URLs for a student, if chosen. */
export async function heroChoices(profile: { avatar_image_id: string | null; banner_image_id: string | null }): Promise<{ avatar: string | null; banner: string | null }> {
  const ids = [profile.avatar_image_id, profile.banner_image_id].filter((x): x is string => !!x);
  if (ids.length === 0) return { avatar: null, banner: null };
  const admin = createAdminClient();
  const { data } = await admin.from("hero_images").select("id, path").in("id", ids);
  const urls = await signHeroUrls((data ?? []) as { id: string; path: string }[]);
  return { avatar: profile.avatar_image_id ? urls.get(profile.avatar_image_id) ?? null : null, banner: profile.banner_image_id ? urls.get(profile.banner_image_id) ?? null : null };
}
