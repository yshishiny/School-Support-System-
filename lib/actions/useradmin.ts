"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { failed } from "@/lib/ops/fault";
import { emailProblem, may, passwordProblem, type Action, type Actor, type Subject } from "@/lib/accounts/rights";

const CHILD_DOMAIN = process.env.CHILD_LOGIN_DOMAIN ?? "study.local";
const PATHS = ["/parent", "/parent/children", "/parent/people", "/parent/admin", "/parent/settings"];

export interface AdminState { error?: string; ok?: string }

interface Resolved { actor: Actor; subject: Subject; actorFamily: string }

/**
 * Loads both people and asks `lib/accounts/rights` whether this is allowed.
 *
 * Every action below goes through here and nothing else decides. The counts it gathers — how many
 * administrators exist, how many parents the subject's family has — are the ones the last-one-standing rules
 * need, and reading them here means no caller can forget to.
 */
async function authorise(subjectId: string, action: Action): Promise<Resolved | { error: string }> {
  const { profile } = await requireParent();
  const admin = createAdminClient();
  const { data: s } = await admin
    .from("profiles").select("id, family_id, role, is_admin, is_family_owner, disabled_at, full_name")
    .eq("id", subjectId).maybeSingle();
  if (!s) return { error: "No such account." };

  const [{ count: admins }, { count: parents }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_admin", true).is("disabled_at", null),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("family_id", s.family_id).eq("role", "parent").is("disabled_at", null),
  ]);

  const actor: Actor = {
    id: profile.id,
    familyId: profile.family_id,
    role: "parent",
    isAdmin: !!(profile as { is_admin?: boolean }).is_admin,
    isFamilyOwner: !!(profile as { is_family_owner?: boolean }).is_family_owner,
  };
  const subject: Subject = {
    id: s.id, familyId: s.family_id, role: s.role as "parent" | "student",
    isAdmin: !!s.is_admin, isFamilyOwner: !!s.is_family_owner, disabled: !!s.disabled_at,
  };

  const verdict = may(actor, subject, action, { admins: admins ?? 0, parentsInFamily: parents ?? 0 });
  if (!verdict.ok) {
    await audit(actor.id, subject.id, subject.familyId, action, verdict.why, false);
    return { error: verdict.why };
  }
  return { actor, subject, actorFamily: profile.family_id };
}

async function audit(actorId: string, subjectId: string, familyId: string, action: string, detail: string, ok: boolean) {
  await createAdminClient().from("account_audit").insert({
    actor_id: actorId, subject_id: subjectId, family_id: familyId, action, detail: detail.slice(0, 500), ok,
  });
}

/** A parent sets a new password for someone they administer. No current password: that is the whole point. */
export async function resetPasswordAction(_prev: AdminState | undefined, formData: FormData): Promise<AdminState> {
  const subjectId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const problem = passwordProblem(password, confirm);
  if (problem) return { error: problem };

  const r = await authorise(subjectId, "reset_password");
  if ("error" in r) return { error: r.error };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(subjectId, { password });
  if (error) {
    await audit(r.actor.id, subjectId, r.subject.familyId, "reset_password", error.message, false);
    return failed("actions.useradmin.resetPassword", error);
  }
  await audit(r.actor.id, subjectId, r.subject.familyId, "reset_password", "set a new password", true);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: "Password set. Tell them what it is — it is not shown again." };
}

/** Sets an address on someone else's account, confirmed outright because a parent is vouching for it. */
export async function setUserEmailAction(_prev: AdminState | undefined, formData: FormData): Promise<AdminState> {
  const subjectId = String(formData.get("user_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const problem = emailProblem(email, CHILD_DOMAIN);
  if (problem) return { error: problem };

  const r = await authorise(subjectId, "set_email");
  if ("error" in r) return { error: r.error };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(subjectId, { email, email_confirm: true });
  if (error) {
    await audit(r.actor.id, subjectId, r.subject.familyId, "set_email", error.message, false);
    return failed("actions.useradmin.setUserEmail", error);
  }
  await audit(r.actor.id, subjectId, r.subject.familyId, "set_email", email, true);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: `Signs in with ${email} from now on.` };
}

/**
 * Switches an account off, in both places that matter.
 *
 * `disabled_at` on the profile ends the session that is already open, because every request reads it. Banning in
 * the auth service refuses the next sign-in. Doing only the second would leave a child working for another hour.
 */
export async function disableUserAction(_prev: AdminState | undefined, formData: FormData): Promise<AdminState> {
  const subjectId = String(formData.get("user_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || null;
  const r = await authorise(subjectId, "disable");
  if ("error" in r) return { error: r.error };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ disabled_at: new Date().toISOString(), disabled_reason: reason }).eq("id", subjectId);
  if (error) return failed("actions.useradmin.disableUser", error);
  // A century is "until somebody turns it back on"; Supabase has no unbounded ban.
  await admin.auth.admin.updateUserById(subjectId, { ban_duration: `${100 * 365 * 24}h` });
  await audit(r.actor.id, subjectId, r.subject.familyId, "disable", reason ?? "no reason given", true);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: "Switched off. They are signed out on their next click." };
}

export async function enableUserAction(_prev: AdminState | undefined, formData: FormData): Promise<AdminState> {
  const subjectId = String(formData.get("user_id") ?? "");
  const r = await authorise(subjectId, "enable");
  if ("error" in r) return { error: r.error };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ disabled_at: null, disabled_reason: null }).eq("id", subjectId);
  if (error) return failed("actions.useradmin.enableUser", error);
  await admin.auth.admin.updateUserById(subjectId, { ban_duration: "none" });
  await audit(r.actor.id, subjectId, r.subject.familyId, "enable", "switched back on", true);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: "Switched back on." };
}

/** Administrator rights, which cross every family and so are handed out only by an administrator. */
export async function setAdminAction(_prev: AdminState | undefined, formData: FormData): Promise<AdminState> {
  const subjectId = String(formData.get("user_id") ?? "");
  const grant = String(formData.get("grant") ?? "") === "true";
  const r = await authorise(subjectId, grant ? "grant_admin" : "revoke_admin");
  if ("error" in r) return { error: r.error };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ is_admin: grant }).eq("id", subjectId);
  if (error) return failed("actions.useradmin.setAdmin", error);
  await audit(r.actor.id, subjectId, r.subject.familyId, grant ? "grant_admin" : "revoke_admin", "", true);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: grant ? "Now an administrator." : "No longer an administrator." };
}

/** Hands the family over to another parent. One owner per family, so the old one is cleared in the same breath. */
export async function transferOwnershipAction(_prev: AdminState | undefined, formData: FormData): Promise<AdminState> {
  const subjectId = String(formData.get("user_id") ?? "");
  const r = await authorise(subjectId, "transfer_ownership");
  if ("error" in r) return { error: r.error };

  const admin = createAdminClient();
  await admin.from("profiles").update({ is_family_owner: false }).eq("family_id", r.subject.familyId).eq("role", "parent");
  const { error } = await admin.from("profiles").update({ is_family_owner: true }).eq("id", subjectId);
  if (error) return failed("actions.useradmin.transferOwnership", error);
  await audit(r.actor.id, subjectId, r.subject.familyId, "transfer_ownership", "handed over", true);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: "They are the main parent now." };
}
