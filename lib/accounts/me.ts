/**
 * What the signed-in person needs to know about their own sign-in, read once and shaped for the panel.
 *
 * `new_email` is the address Supabase is holding until its link is opened; it is not on the profile row, so it
 * has to come from the auth user rather than from the database.
 */
import { createClient } from "@/lib/supabase/server";
import { isPlaceholderEmail } from "@/lib/accounts/rights";

const CHILD_DOMAIN = process.env.CHILD_LOGIN_DOMAIN ?? "study.local";

export interface MyAccount {
  email: string | null;
  pendingEmail: string | null;
  verified: boolean;
  placeholder: boolean;
  username: string | null;
}

export async function myAccount(): Promise<MyAccount> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  const placeholder = isPlaceholderEmail(email, CHILD_DOMAIN);
  const pending = (user as { new_email?: string | null } | null)?.new_email ?? null;
  return {
    email,
    pendingEmail: pending && pending !== email ? pending : null,
    // A stand-in address is confirmed at creation, which says nothing about a real inbox — so it is never
    // reported as verified, or a child would be told his made-up address had been proven.
    verified: !placeholder && !!(user as { email_confirmed_at?: string | null } | null)?.email_confirmed_at,
    placeholder,
    username: placeholder && email ? email.split("@")[0] : null,
  };
}
