"use server";

import { revalidatePath } from "next/cache";
import { requireParent, requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/dates";
import {
  MAX_INVITES, REFERRAL_CREDITS, accessUntil, creditBalance, grantWindow, hasAccess, inviteCode, planById,
  type AccessGrant, type CreditEntry,
} from "@/lib/access";

const PATHS = ["/teach", "/today", "/parent", "/parent/settings", "/parent/admin"];

export interface AccessState {
  credits: number;
  grants: AccessGrant[];
  invites: { id: string; code: string; label: string | null; accepted: boolean; rewarded: boolean }[];
  invitesLeft: number;
}

/** Everything a family needs to see about what it has bought and what it has left. */
export async function loadAccess(familyId: string): Promise<AccessState> {
  const admin = createAdminClient();
  const [{ data: credits }, { data: grants }, { data: invites }] = await Promise.all([
    admin.from("credit_entries").select("delta, kind").eq("family_id", familyId),
    admin.from("access_grants").select("student_id, starts_on, ends_on, plan").eq("family_id", familyId),
    admin.from("access_invites").select("id, code, label, accepted_at, rewarded_at").eq("family_id", familyId).order("created_at"),
  ]);
  const list = (invites ?? []).map((i) => ({ id: i.id as string, code: i.code as string, label: (i.label as string | null) ?? null, accepted: !!i.accepted_at, rewarded: !!i.rewarded_at }));
  return {
    credits: creditBalance((credits ?? []) as CreditEntry[]),
    grants: (grants ?? []) as AccessGrant[],
    invites: list,
    invitesLeft: Math.max(0, MAX_INVITES - list.length),
  };
}

/** Whether this child may open the virtual teacher today. Families with no credit system in use are unaffected. */
export async function childHasAccess(familyId: string, studentId: string, today: string): Promise<{ ok: boolean; until: string | null }> {
  const admin = createAdminClient();
  const { data } = await admin.from("access_grants").select("student_id, starts_on, ends_on, plan").eq("family_id", familyId);
  const grants = (data ?? []) as AccessGrant[];
  return { ok: hasAccess(grants, studentId, today), until: accessUntil(grants, studentId, today) };
}

/** Admin only: hand a family credits, with a reason on the record. */
export async function grantCreditsAction(formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { profile } = await requireSession();
  if (!(profile as { is_admin?: boolean }).is_admin) return { error: "Only the owner can grant credits." };
  const familyId = String(formData.get("family_id") ?? "");
  const amount = Math.round(Number(formData.get("credits") ?? 0));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 120) || "Granted by the owner";
  if (!familyId || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1_000_000) return { error: "Say which family and how many credits." };
  const admin = createAdminClient();
  const { error } = await admin.from("credit_entries").insert({ family_id: familyId, delta: amount, reason, kind: amount > 0 ? "grant" : "refund", granted_by: profile.id });
  if (error) return { error: error.message };
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: `${amount > 0 ? "Gave" : "Took back"} ${Math.abs(amount)} credits.` };
}

/** A parent spends the family's credits on a plan, for one child or for everyone. */
export async function buyAccessAction(formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { profile, family } = await requireParent();
  const plan = planById(String(formData.get("plan") ?? ""));
  if (!plan) return { error: "Pick a plan." };
  const studentId = plan.scope === "child" ? String(formData.get("student_id") ?? "") : "";
  if (plan.scope === "child" && !studentId) return { error: "Pick which child." };
  const admin = createAdminClient();

  if (studentId) {
    const { data: kid } = await admin.from("profiles").select("id").eq("id", studentId).eq("family_id", family.id).eq("role", "student").maybeSingle();
    if (!kid) return { error: "That is not one of your children." };
  }

  const state = await loadAccess(family.id);
  if (state.credits < plan.credits) return { error: `That costs ${plan.credits} credits and you have ${state.credits}.` };

  const today = todayIn(family.timezone);
  // Extend rather than overlap: buying early must never throw away days already paid for.
  const currentEnd = plan.scope === "family"
    ? state.grants.filter((g) => g.student_id === null && g.ends_on >= today).map((g) => g.ends_on).sort().reverse()[0] ?? null
    : accessUntil(state.grants.filter((g) => g.student_id === studentId), studentId, today);
  const window = grantWindow(plan, today, currentEnd);

  const { data: grant, error } = await admin
    .from("access_grants")
    .insert({ family_id: family.id, student_id: studentId || null, plan: plan.id, ...window, credits_spent: plan.credits, created_by: profile.id })
    .select("id")
    .single();
  if (error || !grant) return { error: error?.message ?? "Could not record that." };
  await admin.from("credit_entries").insert({ family_id: family.id, delta: -plan.credits, reason: plan.label, kind: "spend", ref_type: "access_grant", ref_id: grant.id, granted_by: profile.id });
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: `Done. Access runs to ${window.ends_on}.` };
}

/** A parent makes one of their two invite links. */
export async function createInviteAction(formData: FormData): Promise<{ error?: string; ok?: string; code?: string }> {
  const { profile, family } = await requireParent();
  const state = await loadAccess(family.id);
  if (state.invitesLeft <= 0) return { error: `You can invite ${MAX_INVITES} families, and both are used.` };
  const label = String(formData.get("label") ?? "").trim().slice(0, 60) || null;
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = inviteCode();
    const { data, error } = await admin.from("access_invites").insert({ family_id: family.id, code, label, created_by: profile.id }).select("code").single();
    if (!error && data) {
      PATHS.forEach((p) => revalidatePath(p));
      return { ok: "Invite ready. Send them the link.", code: data.code as string };
    }
    if (error && !error.message.includes("duplicate")) return { error: error.message };
  }
  return { error: "Could not make a code; try once more." };
}

/**
 * The invited family enters the code. The inviter is paid only once, and only when the code is used by a family
 * that is not their own, so nobody can pay themselves.
 */
export async function redeemInviteAction(formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { family } = await requireParent();
  const code = String(formData.get("code") ?? "").trim().toUpperCase().slice(0, 12);
  if (code.length < 4) return { error: "Type the code they sent you." };
  const admin = createAdminClient();
  const { data: invite } = await admin.from("access_invites").select("id, family_id, accepted_family_id, rewarded_at").eq("code", code).maybeSingle();
  if (!invite) return { error: "No invite with that code." };
  if (invite.family_id === family.id) return { error: "That is your own invite." };
  if (invite.accepted_family_id) return { error: "That invite has already been used." };
  const { data: used } = await admin.from("access_invites").select("id").eq("accepted_family_id", family.id).maybeSingle();
  if (used) return { error: "Your family has already used an invite." };

  await admin.from("access_invites").update({ accepted_family_id: family.id, accepted_at: new Date().toISOString(), rewarded_at: new Date().toISOString() }).eq("id", invite.id);
  await admin.from("credit_entries").insert({ family_id: invite.family_id as string, delta: REFERRAL_CREDITS, reason: "A family you invited started using it", kind: "referral", ref_type: "access_invite", ref_id: invite.id });
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: "Welcome. The family who invited you has been thanked." };
}
