"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { buildMonthlyRevisions } from "@/lib/revision/run";

/** Parent's button: build this month's revision now for one child (or all), whatever the date. */
export async function buildRevisionNowAction(studentId: string | null): Promise<{ error?: string; lines?: string[] }> {
  const { family } = await requireParent();
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not configured on the server." };
  const lines = await buildMonthlyRevisions(todayIn(family.timezone), { force: true, studentId: studentId ?? undefined, budgetMs: 240_000 });
  ["/parent/materials", "/learn", "/today"].forEach((p) => revalidatePath(p));
  return { lines: lines.length ? lines : ["Nothing to build: no school files with a study digest this month."] };
}
