import { createAdminClient } from "@/lib/supabase/admin";
import { creditBalance, invitesAllowed, tierFor, type AccessGrant, type CreditEntry } from "@/lib/access";

/**
 * Reading what a family has bought.
 *
 * A server helper, not an action. It used to sit in `lib/actions/access.ts`, and every export of a `"use server"`
 * module is a callable endpoint — so a function taking a family id and reading with the service-role key amounted
 * to "show me any family's credits, purchases, invite codes and referral earnings". Nothing about it was ever
 * meant to be reachable from outside; its callers all hold a family id that `requireParent()` or
 * `requireStudent()` has already established.
 */

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
