"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const CHILD_DOMAIN = process.env.CHILD_LOGIN_DOMAIN ?? "study.local";

/** Children log in with a username; we turn it into their internal email. */
export async function normalizeLogin(input: string): Promise<string> {
  const v = input.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${CHILD_DOMAIN}`;
}

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = await normalizeLogin(String(formData.get("login") ?? ""));
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Wrong username or password." };
  redirect("/");
}

export async function signupAction(_prev: { error?: string; done?: boolean } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const familyName = String(formData.get("family_name") ?? "").trim() || `${fullName}'s family`;
  if (!email || password.length < 8 || !fullName) {
    return { error: "Fill in your name, email and a password of at least 8 characters." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role: "parent", full_name: fullName, family_name: familyName } },
  });
  if (error) return { error: error.message };
  if (data.session) redirect("/parent");
  return { done: true };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
