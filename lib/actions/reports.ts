"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { generateAndSendReport } from "@/lib/reports/generate";

export async function sendReportNowAction(_prev: { error?: string; ok?: string } | undefined) {
  const { family } = await requireParent();
  try {
    const r = await generateAndSendReport(family.id, { force: true });
    revalidatePath("/parent/reports");
    revalidatePath("/parent");
    if (r.skipped) return { ok: "Already generated." };
    return r.sent ? { ok: `Sent via ${r.channel}.` } : { ok: `Report generated. Not sent: ${r.error}` };
  } catch (err) {
    console.error("[daily-report] generation failed", err);
    return { error: `Report failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
