"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { failed } from "@/lib/ops/fault";
import { emailProblem, isPlaceholderEmail, passwordProblem } from "@/lib/accounts/rights";

const CHILD_DOMAIN = process.env.CHILD_LOGIN_DOMAIN ?? "study.local";

export interface AccountState { error?: string; ok?: string }

/**
 * Proves the person at the keyboard knows the current password, without disturbing the session they are using.
 *
 * A separate client with no cookie handling: signing in through the request's own client would rewrite its
 * cookies as a side effect of a check, which is a surprising thing for a validation step to do.
 */
async function currentPasswordIsRight(email: string, password: string): Promise<boolean> {
  const probe = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  return !error;
}

/**
 * Your own password, changed by you.
 *
 * The current one is required even though the session already proves who you are: a session is only evidence
 * that this browser was left signed in, and an unattended laptop should not be enough to take an account over.
 */
export async function changeMyPasswordAction(_prev: AccountState | undefined, formData: FormData): Promise<AccountState> {
  const { profile } = await requireSession();
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  const problem = passwordProblem(next, confirm);
  if (problem) return { error: problem };
  if (next === current) return { error: "That is the password you already have." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Could not read your account." };

  if (!(await currentPasswordIsRight(user.email, current))) {
    return { error: "That is not your current password." };
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return failed("actions.account.changeMyPassword", error);

  await createAdminClient().from("account_audit").insert({
    actor_id: profile.id, subject_id: profile.id, family_id: profile.family_id,
    action: "change_own_password", detail: "self-service", ok: true,
  });
  ["/me", "/parent/settings"].forEach((p) => revalidatePath(p));
  return { ok: "Password changed. It is in use from now on." };
}

/**
 * Your own email, set or changed by you.
 *
 * Supabase does not move the address until the new one is confirmed, so the old inbox keeps working until the
 * new one is proven — which is what stops a typo locking somebody out of their own account.
 */
export async function changeMyEmailAction(_prev: AccountState | undefined, formData: FormData): Promise<AccountState> {
  const { profile } = await requireSession();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const problem = emailProblem(email, CHILD_DOMAIN);
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email?.toLowerCase() === email) return { error: "That is already your address." };

  const { error } = await supabase.auth.updateUser({ email });
  if (error) return failed("actions.account.changeMyEmail", error);

  await createAdminClient().from("account_audit").insert({
    actor_id: profile.id, subject_id: profile.id, family_id: profile.family_id,
    action: "change_own_email", detail: email, ok: true,
  });
  ["/me", "/parent/settings"].forEach((p) => revalidatePath(p));
  return {
    ok: isPlaceholderEmail(user?.email, CHILD_DOMAIN)
      ? `Check ${email} and open the link. Until you do, keep signing in with your username.`
      : `Check ${email} and open the link. Your old address keeps working until you do.`,
  };
}

/** Sends the confirmation link again, for the address that is waiting to be proven. */
export async function resendMyVerificationAction(): Promise<AccountState> {
  const { profile } = await requireSession();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const pending = (user as { new_email?: string } | null)?.new_email ?? user?.email;
  if (!pending) return { error: "There is no address to confirm." };
  if (isPlaceholderEmail(pending, CHILD_DOMAIN)) return { error: "Add a real email address first." };

  const { error } = await supabase.auth.resend({ type: "email_change", email: pending });
  if (error) {
    const retry = await supabase.auth.resend({ type: "signup", email: pending });
    if (retry.error) return failed("actions.account.resendVerification", retry.error);
  }
  await createAdminClient().from("account_audit").insert({
    actor_id: profile.id, subject_id: profile.id, family_id: profile.family_id,
    action: "resend_verification", detail: pending, ok: true,
  });
  return { ok: `Sent again to ${pending}.` };
}
