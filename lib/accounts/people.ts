/**
 * The people a signed-in parent may administer, with the facts an administration screen needs.
 *
 * Scope is decided here rather than in the page: a system administrator sees every account, a parent sees their
 * own family. Getting that wrong on the page would show one family another family's addresses, so it is one
 * function with one rule.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlaceholderEmail } from "@/lib/accounts/rights";

const CHILD_DOMAIN = process.env.CHILD_LOGIN_DOMAIN ?? "study.local";

export interface Person {
  id: string;
  fullName: string;
  role: "parent" | "student";
  familyId: string;
  familyName: string;
  isAdmin: boolean;
  isFamilyOwner: boolean;
  disabledAt: string | null;
  disabledReason: string | null;
  email: string | null;
  /** A stand-in address is never "verified": it was confirmed at creation and proves nothing about an inbox. */
  verified: boolean;
  placeholder: boolean;
  username: string | null;
  lastSignIn: string | null;
  avatarEmoji: string;
}

export interface AuditRow { id: string; action: string; detail: string | null; ok: boolean; created_at: string; actor: string; subject: string }

export async function peopleFor(viewer: { familyId: string; isAdmin: boolean }): Promise<Person[]> {
  const admin = createAdminClient();
  let q = admin
    .from("profiles")
    .select("id, full_name, role, family_id, is_admin, is_family_owner, disabled_at, disabled_reason, avatar_emoji, families(name)")
    .order("role")
    .order("created_at");
  if (!viewer.isAdmin) q = q.eq("family_id", viewer.familyId);
  const { data: rows } = await q;
  const profiles = (rows ?? []) as unknown as {
    id: string; full_name: string; role: "parent" | "student"; family_id: string;
    is_admin: boolean; is_family_owner: boolean; disabled_at: string | null; disabled_reason: string | null;
    avatar_emoji: string; families: { name: string } | null;
  }[];
  if (profiles.length === 0) return [];

  // The addresses and sign-in times live in the auth schema, which PostgREST does not expose.
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const byId = new Map((authList?.users ?? []).map((u) => [u.id, u]));

  return profiles.map((p) => {
    const u = byId.get(p.id);
    const email = u?.email ?? null;
    const placeholder = isPlaceholderEmail(email, CHILD_DOMAIN);
    return {
      id: p.id,
      fullName: p.full_name,
      role: p.role,
      familyId: p.family_id,
      familyName: p.families?.name ?? "—",
      isAdmin: !!p.is_admin,
      isFamilyOwner: !!p.is_family_owner,
      disabledAt: p.disabled_at,
      disabledReason: p.disabled_reason,
      email,
      verified: !placeholder && !!u?.email_confirmed_at,
      placeholder,
      username: placeholder && email ? email.split("@")[0] : null,
      lastSignIn: u?.last_sign_in_at ?? null,
      avatarEmoji: p.avatar_emoji ?? "🙂",
    };
  });
}

/** What has been done to accounts lately, newest first. */
export async function recentAudit(viewer: { familyId: string; isAdmin: boolean }, limit = 30): Promise<AuditRow[]> {
  const admin = createAdminClient();
  let q = admin
    .from("account_audit")
    .select("id, action, detail, ok, created_at, actor:actor_id(full_name), subject:subject_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!viewer.isAdmin) q = q.eq("family_id", viewer.familyId);
  const { data } = await q;
  return ((data ?? []) as unknown as {
    id: string; action: string; detail: string | null; ok: boolean; created_at: string;
    actor: { full_name: string } | null; subject: { full_name: string } | null;
  }[]).map((r) => ({
    id: r.id, action: r.action, detail: r.detail, ok: r.ok, created_at: r.created_at,
    actor: r.actor?.full_name ?? "—", subject: r.subject?.full_name ?? "—",
  }));
}
