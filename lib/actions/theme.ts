"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/themes";

export async function setThemeAction(themeId: string): Promise<{ ok: boolean }> {
  const { profile } = await requireStudent();
  if (!THEMES.some((t) => t.id === themeId)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ theme: themeId }).eq("id", profile.id);
  ["/today", "/learn", "/calendar", "/rewards", "/me"].forEach((p) => revalidatePath(p));
  return { ok: !error };
}

/** Which Today layout the student wants: a (three things), b (one thing now), c (picture and tiles). */
export async function setHomeLayoutAction(layout: "a" | "b" | "c"): Promise<{ ok: boolean }> {
  const { profile } = await requireStudent();
  if (!["a", "b", "c"].includes(layout)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ home_layout: layout }).eq("id", profile.id);
  ["/today", "/me"].forEach((p) => revalidatePath(p));
  return { ok: !error };
}
