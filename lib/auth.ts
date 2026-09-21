import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rememberWho } from "@/lib/ops/who";
import type { Family, Profile } from "@/lib/types";

export interface Session {
  userId: string;
  profile: Profile;
  family: Family;
}

/** Loads the signed-in user's profile and family, or redirects to /login. */
export async function requireSession(): Promise<Session> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login?error=no_profile");
  const { data: family } = await supabase.from("families").select("*").eq("id", profile.family_id).single();
  if (!family) redirect("/login?error=no_family");
  // A switched-off account stops working now, not when its token next expires. Banning in the auth service
  // refuses the *next* sign-in; without this a child who is already signed in carries on for another hour.
  if ((profile as { disabled_at?: string | null }).disabled_at) {
    await supabase.auth.signOut();
    redirect("/login?error=disabled");
  }
  // Anything that fails later in this request is logged against the person who hit it, with no extra plumbing.
  rememberWho({ userId: user.id, familyId: profile.family_id, name: profile.full_name, role: profile.role });
  return { userId: user.id, profile: profile as Profile, family: family as Family };
}

export async function requireParent(): Promise<Session> {
  const s = await requireSession();
  if (s.profile.role !== "parent") redirect("/today");
  return s;
}

export async function requireStudent(): Promise<Session> {
  const s = await requireSession();
  if (s.profile.role !== "student") redirect("/parent");
  return s;
}

/** Administrator only (profiles.is_admin): the operations page. */
export async function requireAdmin(): Promise<Session> {
  const s = await requireParent();
  if (!(s.profile as { is_admin?: boolean }).is_admin) redirect("/parent");
  return s;
}
