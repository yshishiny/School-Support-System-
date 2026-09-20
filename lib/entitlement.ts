import type { Level } from "@/lib/levels";

/**
 * Whether a child may open the deeper version of a lesson.
 *
 * This is the one place the two sites genuinely differ, so it is the one file that differs. Here on the live
 * site there is nothing to sell and nothing to buy: every child gets the basics, free, and the deep version
 * lives on the beta with the teacher who performs it. On the beta this same function consults what the family
 * has paid for. Every page above it is written once and works on both.
 */
export async function deepUnlocked(_studentId: string, _familyId: string): Promise<boolean> {
  return false;
}

/** The depth to open by default: the deepest one he is allowed. */
export async function defaultLevel(studentId: string, familyId: string): Promise<Level> {
  return (await deepUnlocked(studentId, familyId)) ? "advanced" : "basics";
}
