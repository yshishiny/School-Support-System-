"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** The student's interests and favourite subjects: they flavour quizzes and the coach's notes. */
export async function setInterestsAction(_prev: { ok?: boolean; error?: string } | undefined, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const { profile } = await requireStudent();
  const interests = String(formData.get("interests") ?? "").trim().slice(0, 300) || null;
  const favourites = formData.getAll("favourite").map(String).filter(Boolean).slice(0, 6);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ interests, favourite_subjects: favourites }).eq("id", profile.id);
  if (error) return { error: error.message };
  ["/me", "/today", "/learn"].forEach((p) => revalidatePath(p));
  return { ok: true };
}
