import { createAdminClient } from "@/lib/supabase/admin";

/**
 * How many weeks in a row a child has closed on the full band.
 *
 * A server helper, not an action. Exported from a `"use server"` module it took any student id and read with the
 * service-role key; its callers pass the child's own id, which they already hold.
 */

/** Consecutive closed weeks that paid the full allowance, newest first. */
export async function fullWeekStreak(studentId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.from("allowance_weeks").select("band").eq("student_id", studentId).order("week_start", { ascending: false }).limit(12);
  let n = 0;
  for (const w of data ?? []) { if (w.band === "full") n += 1; else break; }
  return n;
}
