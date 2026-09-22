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
  /** The name the file had on the uploader's device. The AI title is not unique; this is what a person recognises. */
  original_name: string | null;
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
  worksheet: { questions: { prompt: string; choices: string[]; correct_index: number; explanation: string; skill_tag: string; original_type: string }[]; skipped: number; note: string; model: string; prepared_at: string } | null;
  created_at: string;
  is_week_summary?: boolean;
  covers_week_start?: string | null;
  covers_from?: string | null;
  covers_to?: string | null;
  date_note?: string | null;
  subjects?: { subject: string; topics: string[] }[] | null;
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
