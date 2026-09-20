"use server";

import { revalidatePath } from "next/cache";
import { failed } from "@/lib/ops/fault";
import { requireParent, requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/dates";
import { CLAIM_PURPOSES, SPEND_CATEGORIES, claimable, type WalletEntry } from "@/lib/wallet";

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
    .select("id, kind, amount_egp, label, category, occurred_on, note, claim_status, claim_purpose, claim_reason, asked_permission, claim_note")
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
  if (error) return failed("actions.wallet.handOver", error);
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
  if (error) return failed("actions.wallet.adjustWallet", error);
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
  if (error) return failed("actions.wallet.spend", error);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: `${amount} EGP written down.` };
}

/**
 * "Pay me back for this." Only money spent on the family or on school may be claimed, and he has to say what it
 * was for, why he spent it and whether he asked first. A parent decides; nothing moves until then.
 */
export async function claimExpenseAction(formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { profile } = await requireStudent();
  const id = String(formData.get("id") ?? "");
  const purpose = CLAIM_PURPOSES.some((p) => p.id === formData.get("purpose")) ? String(formData.get("purpose")) : "";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  const asked = String(formData.get("asked") ?? "");
  if (!purpose) return { error: "Say whether it was for the family or for school. Anything personal cannot be claimed." };
  if (reason.length < 10) return { error: "Say in a sentence why you spent it and why it should be paid back." };
  if (asked !== "yes" && asked !== "no") return { error: "Say whether you asked permission first." };
  const admin = createAdminClient();
  const { data: row } = await admin.from("wallet_entries").select("id, kind, student_id, claim_status").eq("id", id).maybeSingle();
  if (!row || row.student_id !== profile.id) return { error: "That is not your line." };
  if (!claimable(row as Pick<WalletEntry, "kind" | "claim_status">)) return { error: "That one cannot be claimed." };
  const { error } = await admin
    .from("wallet_entries")
    .update({ claim_status: "requested", claim_purpose: purpose, claim_reason: reason, asked_permission: asked === "yes", claim_decided_by: null, claim_decided_at: null })
    .eq("id", id);
  if (error) return failed("actions.wallet.claimExpense", error);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: asked === "yes" ? "Asked for. Your dad will look at it." : "Asked for. Be honest that you did not ask first; he decides." };
}

/** The parent decides a claim. Approving pays the amount back into the child's wallet, once. */
export async function decideClaimAction(formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { profile, family } = await requireParent();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approved" && decision !== "rejected") return { error: "Approve it or turn it down." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
  const admin = createAdminClient();
  const { data: row } = await admin.from("wallet_entries").select("id, student_id, family_id, amount_egp, label, claim_status, occurred_on").eq("id", id).eq("family_id", family.id).maybeSingle();
  if (!row || row.claim_status !== "requested") return { error: "Nothing to decide on that one." };
  await admin.from("wallet_entries").update({ claim_status: decision, claim_note: note, claim_decided_by: profile.id, claim_decided_at: new Date().toISOString() }).eq("id", id);
  if (decision === "approved") {
    await creditWallet({
      studentId: row.student_id as string,
      familyId: family.id,
      amount: Number(row.amount_egp),
      label: `Paid back: ${row.label}`,
      on: todayIn(family.timezone),
      refType: "expense_claim",
      refId: row.id as string,
      by: profile.id,
    });
  }
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: decision === "approved" ? `${Number(row.amount_egp)} EGP put back.` : "Turned down." };
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
