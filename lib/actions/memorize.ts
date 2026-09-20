"use server";

import { revalidatePath } from "next/cache";
import { failed } from "@/lib/ops/fault";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAyahs } from "@/lib/quran";
import { MEMORIZE_POINTS } from "@/lib/learning";
import { todayIn } from "@/lib/dates";

export interface MemorizeFormResult {
  error?: string;
  id?: string;
}

export async function addQuranItemAction(_prev: MemorizeFormResult | undefined, formData: FormData): Promise<MemorizeFormResult> {
  const { profile } = await requireStudent();
  const surah = Number(formData.get("surah"));
  const from = Number(formData.get("from") || 1);
  const to = Number(formData.get("to") || from);
  if (!surah) return { error: "Choose a surah." };
  try {
    const { title, reference, ayahs } = await fetchAyahs(surah, from, to);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("memorize_items")
      .insert({
        student_id: profile.id,
        kind: "quran",
        title,
        reference,
        text_ar: ayahs.map((a) => a.text).join(" "),
        translation: ayahs.map((a) => a.translation).filter(Boolean).join(" "),
        segments: ayahs,
      })
      .select("id")
      .single();
    if (error || !data) return failed("actions.memorize.addQuranItem", error, "Could not save.");
    revalidatePath("/learn/memorize");
    return { id: data.id };
  } catch (err) {
    return failed("actions.memorize.addQuranItem", err, "Could not fetch the ayahs.");
  }
}

export async function addHadithItemAction(_prev: MemorizeFormResult | undefined, formData: FormData): Promise<MemorizeFormResult> {
  const { profile } = await requireStudent();
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const text = String(formData.get("text") ?? "").trim().slice(0, 3000);
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 120) || null;
  const translation = String(formData.get("translation") ?? "").trim().slice(0, 3000) || null;
  if (!title || text.length < 10) return { error: "Give the hadith a title and paste its text from your book." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memorize_items")
    .insert({ student_id: profile.id, kind: "hadith", title, reference, text_ar: text, translation, segments: [{ ref: reference ?? title, text, translation }] })
    .select("id")
    .single();
  if (error || !data) return failed("actions.memorize.addHadithItem", error, "Could not save.");
  revalidatePath("/learn/memorize");
  return { id: data.id };
}

export async function deleteMemorizeItemAction(id: string): Promise<void> {
  const { profile } = await requireStudent();
  const supabase = await createClient();
  await supabase.from("memorize_items").delete().eq("id", id).eq("student_id", profile.id);
  revalidatePath("/learn/memorize");
}

/** Records a recall session (score 0-100) and pays once per item per day. */
export async function recordMemorizeSessionAction(id: string, score: number): Promise<{ earned: number; best: number }> {
  const { profile, family } = await requireStudent();
  const today = todayIn(family.timezone);
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const admin = createAdminClient();
  const { data: item } = await admin.from("memorize_items").select("id, best_score, sessions").eq("id", id).eq("student_id", profile.id).single();
  if (!item) throw new Error("Item not found.");
  const best = Math.max(item.best_score ?? 0, pct);
  await admin.from("memorize_items").update({ best_score: best, sessions: item.sessions + 1, last_practised: today }).eq("id", id);

  let earned = 0;
  const { data: paidToday } = await admin
    .from("points_ledger")
    .select("id")
    .eq("student_id", profile.id)
    .eq("ref_type", "memorize")
    .eq("ref_id", id)
    .gte("created_at", `${today}T00:00:00Z`)
    .limit(1);
  if (!paidToday || paidToday.length === 0) {
    const delta = MEMORIZE_POINTS.SESSION + (pct >= 95 ? MEMORIZE_POINTS.PERFECT_BONUS : 0);
    // ref_id is unique per (student, type, id) only for the first payout; later days use a null ref so they are allowed.
    const { error } = await admin.from("points_ledger").insert({ student_id: profile.id, delta, reason: `Recited from memory (${pct}%)`, ref_type: "memorize", ref_id: item.sessions === 0 ? id : null });
    if (!error) earned = delta;
  }
  ["/learn/memorize", "/today", "/rewards"].forEach((p) => revalidatePath(p));
  return { earned, best };
}
