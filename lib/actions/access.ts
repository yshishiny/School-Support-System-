"use server";

import { revalidatePath } from "next/cache";
import { requireParent, requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/dates";
import {
  REFERRAL_BONUS_CREDITS, accessUntil, bonusDue, commissionFor, creditBalance, grantWindow, hasAccess, inviteCode,
  invitesAllowed, planById, priceAfterWelcome, tierFor,
  type AccessGrant, type CreditEntry,
} from "@/lib/access";

const PATHS = ["/teach", "/today", "/parent", "/parent/settings", "/parent/admin"];

export interface AccessState {
  credits: number;
  grants: AccessGrant[];
  invites: { id: string; code: string; label: string | null; accepted: boolean; rewarded: boolean }[];
  invitesLeft: number;
  /** The families this one brought, and what each has actually paid. */
  referred: { familyId: string; name: string; joinedOn: string; payments: number; creditsSpent: number; live: boolean; bonusPaid: boolean }[];
  payingReferred: number;
  tier: ReturnType<typeof tierFor>;
  commissionEarned: number;
  welcomeUsed: boolean;
  invitedBy: string | null;
}

/** Everything a family needs to see about what it has bought and what it has left. */
export async function loadAccess(familyId: string): Promise<AccessState> {
  const admin = createAdminClient();
  const [{ data: credits }, { data: grants }, { data: invites }, { data: me }, { data: children }] = await Promise.all([
    admin.from("credit_entries").select("delta, kind, ref_type").eq("family_id", familyId),
    admin.from("access_grants").select("student_id, starts_on, ends_on, plan").eq("family_id", familyId),
    admin.from("access_invites").select("id, code, label, accepted_at, rewarded_at, accepted_family_id").eq("family_id", familyId).order("created_at"),
    admin.from("families").select("welcome_used, invited_by_family_id").eq("id", familyId).maybeSingle(),
    admin.from("families").select("id, name, created_at").eq("invited_by_family_id", familyId),
  ]);
  const list = (invites ?? []).map((i) => ({ id: i.id as string, code: i.code as string, label: (i.label as string | null) ?? null, accepted: !!i.accepted_at, rewarded: !!i.rewarded_at }));
  const kids = (children ?? []) as { id: string; name: string | null; created_at: string }[];

  // What each referred family has actually paid for, which is what the ladder and the commission are built on.
  const today = new Date().toISOString().slice(0, 10);
  const referred = await Promise.all(kids.map(async (f) => {
    const { data: theirGrants } = await admin.from("access_grants").select("credits_spent, ends_on").eq("family_id", f.id);
    const rows = (theirGrants ?? []) as { credits_spent: number; ends_on: string }[];
    const paid = rows.filter((g) => Number(g.credits_spent) > 0);
    const invite = (invites ?? []).find((i) => i.accepted_family_id === f.id);
    return {
      familyId: f.id,
      name: f.name ?? "A family",
      joinedOn: f.created_at.slice(0, 10),
      payments: paid.length,
      creditsSpent: paid.reduce((n, g) => n + Number(g.credits_spent), 0),
      live: rows.some((g) => g.ends_on >= today),
      bonusPaid: !!invite?.rewarded_at,
    };
  }));

  const payingReferred = referred.filter((r) => r.payments > 0).length;
  const entries = (credits ?? []) as (CreditEntry & { ref_type: string | null })[];
  return {
    credits: creditBalance(entries),
    grants: (grants ?? []) as AccessGrant[],
    invites: list,
    invitesLeft: Math.max(0, invitesAllowed(referred.filter((r) => r.payments >= 1).length) - list.length),
    referred,
    payingReferred,
    tier: tierFor(payingReferred),
    commissionEarned: entries.filter((e) => e.ref_type === "commission").reduce((n, e) => n + e.delta, 0),
    welcomeUsed: !!me?.welcome_used,
    invitedBy: (me?.invited_by_family_id as string | null) ?? null,
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
  // A family that came in on an invitation pays a quarter less, on their first purchase only.
  const price = state.invitedBy ? priceAfterWelcome(plan.credits, state.welcomeUsed) : plan.credits;
  const discounted = price < plan.credits;
  if (state.credits < price) return { error: `That costs ${price} credits and you have ${state.credits}.` };

  const today = todayIn(family.timezone);
  // Extend rather than overlap: buying early must never throw away days already paid for.
  const currentEnd = plan.scope === "family"
    ? state.grants.filter((g) => g.student_id === null && g.ends_on >= today).map((g) => g.ends_on).sort().reverse()[0] ?? null
    : accessUntil(state.grants.filter((g) => g.student_id === studentId), studentId, today);
  const window = grantWindow(plan, today, currentEnd);

  const { data: grant, error } = await admin
    .from("access_grants")
    .insert({ family_id: family.id, student_id: studentId || null, plan: plan.id, ...window, credits_spent: price, discounted, created_by: profile.id })
    .select("id")
    .single();
  if (error || !grant) return { error: error?.message ?? "Could not record that." };
  await admin.from("credit_entries").insert({ family_id: family.id, delta: -price, reason: discounted ? `${plan.label} (welcome price)` : plan.label, kind: "spend", ref_type: "access_grant", ref_id: grant.id, granted_by: profile.id });
  if (discounted) await admin.from("families").update({ welcome_used: true }).eq("id", family.id);
  await rewardInviter(family.id, grant.id as string, price);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: `Done${discounted ? " at the welcome price" : ""}. Access runs to ${window.ends_on}.` };
}

/**
 * What a purchase by an invited family pays its inviter: commission at their tier every time, and once — on the
 * second purchase, never the first — a free month. Paying on the second purchase means paying for a family that
 * stayed rather than for a signature. Never throws: the buyer's access must not depend on the inviter's reward.
 */
async function rewardInviter(buyerFamilyId: string, grantId: string, creditsSpent: number): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: buyer } = await admin.from("families").select("name, invited_by_family_id").eq("id", buyerFamilyId).maybeSingle();
    const inviterId = buyer?.invited_by_family_id as string | null;
    if (!inviterId) return;

    // The inviter's tier is decided by how many of their families have paid at all.
    const { data: theirFamilies } = await admin.from("families").select("id").eq("invited_by_family_id", inviterId);
    const ids = (theirFamilies ?? []).map((f) => f.id as string);
    const { data: allGrants } = await admin.from("access_grants").select("family_id, credits_spent").in("family_id", ids.length ? ids : [inviterId]);
    const paidRows = ((allGrants ?? []) as { family_id: string; credits_spent: number }[]).filter((g) => Number(g.credits_spent) > 0);
    const payingFamilies = new Set(paidRows.map((g) => g.family_id)).size;

    const commission = commissionFor(payingFamilies, creditsSpent);
    if (commission > 0) {
      await admin.from("credit_entries").insert({
        family_id: inviterId, delta: commission, kind: "referral",
        reason: `Commission on ${buyer?.name ?? "a family you brought"}`,
        ref_type: "commission", ref_id: grantId,
      });
    }

    // The free month, once, on this family's second purchase.
    const { data: invite } = await admin.from("access_invites").select("id, rewarded_at").eq("family_id", inviterId).eq("accepted_family_id", buyerFamilyId).maybeSingle();
    const purchases = paidRows.filter((g) => g.family_id === buyerFamilyId).length;
    if (invite && bonusDue(purchases, !!invite.rewarded_at)) {
      const { error } = await admin.from("credit_entries").insert({
        family_id: inviterId, delta: REFERRAL_BONUS_CREDITS, kind: "referral",
        reason: `${buyer?.name ?? "A family you brought"} stayed: a free month`,
        ref_type: "referral_bonus", ref_id: invite.id as string,
      });
      if (!error) await admin.from("access_invites").update({ rewarded_at: new Date().toISOString() }).eq("id", invite.id);
    }
  } catch { /* the purchase stands; a reward that fails is chased from the dashboard */ }
}

/** A parent makes one of their two invite links. */
export async function createInviteAction(formData: FormData): Promise<{ error?: string; ok?: string; code?: string }> {
  const { profile, family } = await requireParent();
  const state = await loadAccess(family.id);
  if (state.invitesLeft <= 0) return { error: "All your invitations are out. You get two more for each family that joins and pays." };
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

  await admin.from("access_invites").update({ accepted_family_id: family.id, accepted_at: new Date().toISOString() }).eq("id", invite.id);
  await admin.from("families").update({ invited_by_family_id: invite.family_id as string }).eq("id", family.id);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: "Welcome. A quarter comes off your first month, and the family who invited you is thanked once you stay." };
}
