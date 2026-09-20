import { createAdminClient } from "@/lib/supabase/admin";
import { hasAccess, type AccessGrant } from "@/lib/access";
import { todayIn } from "@/lib/dates";
import { attempt } from "@/lib/ops/fault";
import type { Level } from "@/lib/levels";

/**
 * Whether a child may open the deeper version of a lesson.
 *
 * This is the one place the two sites genuinely differ, so it is the one file that differs. On the live site it
 * simply answers no: there is nothing to sell there, every child gets the basics free, and the depth lives here
 * with the teacher who performs it. Here it asks what the family has paid for. Every page above it is written
 * once and works on both.
 */
export async function deepUnlocked(studentId: string, familyId: string): Promise<boolean> {
  return attempt(
    "entitlement.deepUnlocked",
    async () => {
      const admin = createAdminClient();
      const [{ data: grants }, { data: family }] = await Promise.all([
        admin.from("access_grants").select("student_id, starts_on, ends_on, plan").eq("family_id", familyId),
        admin.from("families").select("timezone").eq("id", familyId).maybeSingle(),
      ]);
      return hasAccess((grants ?? []) as AccessGrant[], studentId, todayIn(family?.timezone ?? "Africa/Cairo"));
    },
    // A lookup that fails must not hand out the paid depth, and must not hide the free lesson either.
    false,
    { userId: studentId, familyId },
  );
}

/** The depth to open by default: the deepest one he is allowed. */
export async function defaultLevel(studentId: string, familyId: string): Promise<Level> {
  return (await deepUnlocked(studentId, familyId)) ? "advanced" : "basics";
}
