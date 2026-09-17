import { logError } from "@/lib/ops/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAyahs, type Ayah } from "@/lib/quran";
import { FALLBACK_PASSAGES, buildQuestion, pickFromSegments, pickIndex, type CompensationRow } from "@/lib/compensation";

/** Opens a compensation for one late entry (idempotent per ref). Never throws: a late entry must always save. */
export async function openCompensation(studentId: string, familyId: string, kind: "prayer" | "checkin" | "classlog", ref: string, label: string): Promise<void> {
  const admin = createAdminClient();
  try {
    const { data: existing } = await admin.from("late_compensations").select("id").eq("student_id", studentId).eq("ref", ref).maybeSingle();
    if (existing) return;
    const { data: items } = await admin.from("memorize_items").select("segments").eq("student_id", studentId).eq("kind", "quran").order("created_at");
    let verses: Ayah[] = [];
    let pool: Ayah[] = [];
    const lists = (items ?? []).map((i) => (i.segments ?? []) as Ayah[]).filter((s) => s.length > 0);
    if (lists.length) {
      const list = lists[pickIndex(ref, lists.length)];
      verses = pickFromSegments(list, ref);
      pool = lists.flat();
    }
    if (verses.length === 0) {
      const p = FALLBACK_PASSAGES[pickIndex(ref, FALLBACK_PASSAGES.length)];
      const got = await fetchAyahs(p.surah, p.from, p.to);
      verses = got.ayahs;
      const other = FALLBACK_PASSAGES[(pickIndex(ref, FALLBACK_PASSAGES.length) + 5) % FALLBACK_PASSAGES.length];
      const more = await fetchAyahs(other.surah, other.from, other.to).catch(() => null);
      pool = [...verses, ...(more?.ayahs ?? [])];
    }
    if (pool.length < 4) {
      const extra = await fetchAyahs(103, 1, 3).catch(() => null);
      pool = [...pool, ...(extra?.ayahs ?? [])];
    }
    const question = buildQuestion(verses, pool, ref);
    await admin.from("late_compensations").insert({ student_id: studentId, family_id: familyId, kind, ref, label, verses, question });
  } catch (err) {
    await logError("compensation.open", err, { familyId, userId: studentId, meta: { ref } });
  }
}

export async function loadCompensations(studentId: string, since: string): Promise<CompensationRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("late_compensations").select("id, kind, ref, label, verses, question, read_at, answered_at, correct, attempts, created_at").eq("student_id", studentId).gte("created_at", `${since}T00:00:00Z`).order("created_at", { ascending: false });
  return (data ?? []) as CompensationRow[];
}
