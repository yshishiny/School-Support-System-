"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TOUR_POINTS = 10;

export async function finishTourAction(): Promise<{ earned: number }> {
  const { profile } = await requireStudent();
  const supabase = await createClient();
  await supabase.from("profiles").update({ tour_seen_at: new Date().toISOString() }).eq("id", profile.id);
  const admin = createAdminClient();
  const { error } = await admin.from("points_ledger").insert({ student_id: profile.id, delta: TOUR_POINTS, reason: "Finished the tour", ref_type: "tour", ref_id: profile.id });
  ["/today", "/me", "/tour"].forEach((p) => revalidatePath(p));
  return { earned: error ? 0 : TOUR_POINTS };
}
