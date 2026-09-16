"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkSource } from "@/lib/sources/check";

export async function addSourceAction(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const { family } = await requireParent();
  const url = String(formData.get("url") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim().slice(0, 80) || "School website";
  const studentId = String(formData.get("student_id") ?? "") || null;
  if (!/^https?:\/\//i.test(url)) return { error: "Paste a full web address starting with http." };
  if (/facebook\.com|instagram\.com/i.test(url)) return { error: "Facebook and Instagram pages cannot be read without logging in, so they will come back empty. Use the school website's news page, or export the WhatsApp group instead." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("sources").insert({ family_id: family.id, student_id: studentId, label, url }).select("id, family_id, label, url, last_hash").single();
  if (error || !data) return { error: error?.message ?? "Could not save." };
  const r = await checkSource(data);
  revalidatePath("/parent/import");
  return r.error ? { error: `Saved, but the first check failed: ${r.error}` } : {};
}

export async function deleteSourceAction(id: string): Promise<void> {
  const { family } = await requireParent();
  const supabase = await createClient();
  await supabase.from("sources").delete().eq("id", id).eq("family_id", family.id);
  revalidatePath("/parent/import");
}

export async function checkSourceNowAction(id: string): Promise<{ error?: string; changed?: boolean; items?: number }> {
  const { family } = await requireParent();
  const supabase = await createClient();
  const { data } = await supabase.from("sources").select("id, family_id, label, url, last_hash").eq("id", id).eq("family_id", family.id).maybeSingle();
  if (!data) return { error: "Source not found." };
  await supabase.from("sources").update({ last_hash: null }).eq("id", id); // force a fresh extraction
  const r = await checkSource({ ...data, last_hash: null });
  revalidatePath("/parent/import");
  return r;
}

export async function markFindingReviewedAction(id: string): Promise<void> {
  const { family } = await requireParent();
  const supabase = await createClient();
  await supabase.from("source_findings").update({ status: "reviewed" }).eq("id", id).eq("family_id", family.id);
  revalidatePath("/parent/import");
}
