import { createAdminClient } from "@/lib/supabase/admin";
import type { ExtractedItem } from "@/lib/ai/extract-items";

export const MATERIAL_BUCKET = "materials";

export interface MaterialRow {
  id: string;
  family_id: string;
  student_id: string;
  uploaded_by: string | null;
  subject: string | null;
  title: string;
  instructions: string | null;
  path: string;
  mime: string;
  size_bytes: number;
  status: "new" | "ready" | "failed";
  kind: string | null;
  summary: string | null;
  language: string | null;
  topics: string[] | null;
  digest: string | null;
  items: ExtractedItem[] | null;
  items_reviewed_at: string | null;
  error: string | null;
  pages: number | null;
  created_at: string;
}

/** Signed URLs for private files, keyed by material id. */
export async function signMaterialUrls(rows: { id: string; path: string }[], seconds = 3600): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (rows.length === 0) return out;
  const admin = createAdminClient();
  const { data } = await admin.storage.from(MATERIAL_BUCKET).createSignedUrls(rows.map((r) => r.path), seconds);
  (data ?? []).forEach((d, k) => {
    if (d.signedUrl) out.set(rows[k].id, d.signedUrl);
  });
  return out;
}
