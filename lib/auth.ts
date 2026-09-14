import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
