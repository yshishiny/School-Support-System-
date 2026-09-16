import { createAdminClient } from "@/lib/supabase/admin";
import type { SnapTask } from "@/lib/snaps";

export const SNAP_BUCKET = "snaps";

/** Signed URLs for private snap pictures, keyed by snap id. */
export async function signSnapUrls(snaps: { id: string; path: string }[], seconds = 3600): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (snaps.length === 0) return out;
  const admin = createAdminClient();
  const { data } = await admin.storage.from(SNAP_BUCKET).createSignedUrls(snaps.map((s) => s.path), seconds);
  (data ?? []).forEach((d, k) => {
    if (d.signedUrl) out.set(snaps[k].id, d.signedUrl);
  });
  return out;
}

export async function loadSnapTasks(familyId: string): Promise<SnapTask[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("snap_tasks").select("*").eq("family_id", familyId).order("created_at");
  return (data ?? []) as SnapTask[];
}

/** Retention: photo and homework snaps older than 30 days are deleted (handwriting is kept a year for the trend). */
export async function pruneOldSnaps(): Promise<number> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const hwCutoff = new Date(Date.now() - 365 * 86400000).toISOString();
  const { data } = await admin.from("snaps").select("id, path, kind, created_at").or(`and(kind.neq.handwriting,created_at.lt.${cutoff}),and(kind.eq.handwriting,created_at.lt.${hwCutoff})`).limit(200);
  if (!data?.length) return 0;
  await admin.storage.from(SNAP_BUCKET).remove(data.map((s) => s.path));
  await admin.from("snaps").delete().in("id", data.map((s) => s.id));
  return data.length;
}
