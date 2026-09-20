import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/dates";
import { readAndStore } from "@/lib/materials/read";
import type { MaterialRow } from "@/lib/materials/server";

/**
 * Picking up the uploads that failed for a reason worth retrying — no credit, a busy model, a rate limit.
 *
 * The nightly job calls this. It has no caller to authenticate because it acts on the whole installation, which is
 * exactly why it must not be reachable from a browser: exported from a `"use server"` module it was an unpriced
 * "re-run the reader over every failed upload" button anyone could press.
 */

/** Nightly: re-read files that failed for a temporary reason (credit, busy). Service role, no session. */
export async function retryFailedMaterials(limit = 6): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("materials")
    .select("*, profiles!materials_student_id_fkey(full_name, grade), families!materials_family_id_fkey(timezone)")
    .eq("status", "failed")
    .or("error.ilike.%credit%,error.ilike.%busy%,error.ilike.%rate limit%,error.ilike.%overloaded%")
    .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString())
    .order("created_at")
    .limit(limit);
  const out: string[] = [];
  for (const m of (data ?? []) as (MaterialRow & { profiles: { full_name: string; grade: number | null } | null; families: { timezone: string } | null })[]) {
    const r = await readAndStore(m.id, { path: m.path, mime: m.mime, subject: m.subject, instructions: m.instructions, fallbackTitle: m.title, grade: m.profiles?.grade ?? null, firstName: m.profiles?.full_name.split(" ")[0] ?? "the student", today: todayIn(m.families?.timezone ?? "Africa/Cairo") });
    out.push(`${m.title}: ${r.summary?.startsWith("Saved, but") ? "still failing" : "read"}`);
  }
  return out;
}
