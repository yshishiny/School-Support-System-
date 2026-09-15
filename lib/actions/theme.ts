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
