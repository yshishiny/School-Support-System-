"use server";

import { revalidatePath } from "next/cache";
import { requireParent, requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/dates";
import { SPEND_CATEGORIES, type WalletEntry } from "@/lib/wallet";

const PATHS = ["/wallet", "/allowance", "/me", "/parent", "/parent/allowance"];

function money(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n * 100) / 100;
}

/** Everything in a child's wallet, oldest first, for the balances and the history. */
export async function loadWallet(studentId: string): Promise<WalletEntry[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("wallet_entries")
    .select("id, kind, amount_egp, label, category, occurred_on, note")
    .eq("student_id", studentId)
    .order("occurred_on")
    .order("created_at");
  return ((data ?? []) as WalletEntry[]).map((e) => ({ ...e, amount_egp: Number(e.amount_egp) }));
}

/**
 * Money earned, credited once. `ref` keeps it that way: a paid allowance week or a cash reward can be recorded
 * twice by two taps and still add up only once.
 */
export async function creditWallet(o: { studentId: string; familyId: string; amount: number; label: string; on: string; refType: string; refId: string; by?: string | null }): Promise<void> {
  if (!(o.amount > 0)) return;
  const admin = createAdminClient();
  await admin
    .from("wallet_entries")
    .upsert(
      { student_id: o.studentId, family_id: o.familyId, kind: "earn", amount_egp: o.amount, label: o.label.slice(0, 80), occurred_on: o.on, ref_type: o.refType, ref_id: o.refId, created_by: o.by ?? null },
      { onConflict: "student_id,ref_type,ref_id", ignoreDuplicates: true },
    );
}

/** A hand-over recorded once, keyed to what caused it, so marking a week paid twice cannot take the money twice. */
export async function withdrawFromWallet(o: { studentId: string; familyId: string; amount: number; label: string; on: string; refType: string; refId: string; by?: string | null }): Promise<void> {
  if (!(o.amount > 0)) return;
  const admin = createAdminClient();
  await admin
    .from("wallet_entries")
    .upsert(
      { student_id: o.studentId, family_id: o.familyId, kind: "withdraw", amount_egp: o.amount, label: o.label.slice(0, 80), occurred_on: o.on, ref_type: o.refType, ref_id: o.refId, created_by: o.by ?? null },
      { onConflict: "student_id,ref_type,ref_id", ignoreDuplicates: true },
    );
}

/** The father hands cash over: it leaves the held balance and becomes money in the child's pocket. */
export async function handOverAction(formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { profile, family } = await requireParent();
  const studentId = String(formData.get("student_id") ?? "");
  const amount = money(formData.get("amount"));
  if (!studentId || !amount) return { error: "Say how much was handed over." };
  const on = String(formData.get("on") ?? "") || todayIn(family.timezone);
  const admin = createAdminClient();
  const { error } = await admin.from("wallet_entries").insert({
    student_id: studentId,
    family_id: family.id,
    kind: "withdraw",
    amount_egp: amount,
    label: String(formData.get("label") ?? "").trim().slice(0, 80) || "Handed over in cash",
    occurred_on: on,
    note: String(formData.get("note") ?? "").trim().slice(0, 200) || null,
    ref_type: "manual",
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: `${amount} EGP handed over.` };
}

/** A correction or a gift from a parent, straight into the held balance. */
export async function adjustWalletAction(formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { profile, family } = await requireParent();
  const studentId = String(formData.get("student_id") ?? "");
  const amount = money(formData.get("amount"));
  if (!studentId || !amount) return { error: "Say how much." };
  const admin = createAdminClient();
  const { error } = await admin.from("wallet_entries").insert({
    student_id: studentId,
    family_id: family.id,
    kind: "adjust",
    amount_egp: amount,
    label: String(formData.get("label") ?? "").trim().slice(0, 80) || "Added by a parent",
    occurred_on: String(formData.get("on") ?? "") || todayIn(family.timezone),
    ref_type: "manual",
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: `${amount} EGP added.` };
}

/** The child records what he spent, out of the cash in his pocket. */
export async function spendAction(formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { profile, family } = await requireStudent();
  const amount = money(formData.get("amount"));
  const label = String(formData.get("label") ?? "").trim().slice(0, 80);
  if (!amount) return { error: "How much was it?" };
  if (label.length < 2) return { error: "What did you buy?" };
  const category = SPEND_CATEGORIES.some((c) => c.id === formData.get("category")) ? String(formData.get("category")) : "other";
  const admin = createAdminClient();
  const { error } = await admin.from("wallet_entries").insert({
    student_id: profile.id,
    family_id: family.id,
    kind: "spend",
    amount_egp: amount,
    label,
    category,
    occurred_on: String(formData.get("on") ?? "") || todayIn(family.timezone),
    ref_type: "manual",
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: `${amount} EGP written down.` };
}

/** A line entered by mistake. A child may only take back his own spending. */
export async function deleteWalletEntryAction(id: string): Promise<{ error?: string }> {
  const { profile, family } = await requireStudent().catch(() => ({ profile: null, family: null }) as never);
  const admin = createAdminClient();
  if (profile && family) {
    const { data: row } = await admin.from("wallet_entries").select("id, kind, student_id").eq("id", id).maybeSingle();
    if (!row || row.student_id !== profile.id || row.kind !== "spend") return { error: "Ask a parent to remove that one." };
    await admin.from("wallet_entries").delete().eq("id", id);
    PATHS.forEach((p) => revalidatePath(p));
    return {};
  }
  return { error: "Not allowed." };
}

/** A parent may remove any line in the family. */
export async function parentDeleteWalletEntryAction(id: string): Promise<void> {
  const { family } = await requireParent();
  const admin = createAdminClient();
  await admin.from("wallet_entries").delete().eq("id", id).eq("family_id", family.id);
  PATHS.forEach((p) => revalidatePath(p));
}
