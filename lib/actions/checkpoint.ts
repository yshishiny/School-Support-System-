"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { createCheckpoint } from "@/lib/checkpoint/build";

/** Parent: test a child now on one subject (or the whole week). One attempt, timed. */
export async function requestSpotCheckAction(_prev: { error?: string; ok?: string } | undefined, formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { family, profile } = await requireParent();
  const studentId = String(formData.get("student_id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim() || null;
  if (!studentId) return { error: "Pick a child." };
  const r = await createCheckpoint({ studentId, familyId: family.id, kind: "spot", subject, requestedBy: profile.id, today: todayIn(family.timezone), payWeekday: family.allowance_pay_weekday });
  ["/parent", "/parent/progress", "/today"].forEach((p) => revalidatePath(p));
  return r.error ? { error: r.error } : { ok: `Spot check ready: ${r.questions} questions. He has been notified.` };
}
