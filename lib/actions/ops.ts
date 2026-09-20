"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/ops/log";

/**
 * The browser's error boundary reports a real (non-stale-deploy) failure here. `builds` carries the commit the
 * page was built from and the one answering now: when they match, the fault is genuinely in the code.
 *
 * `stack` is the browser's stack, and it matters more than it looks. This used to build a fresh `new Error(message)`
 * here on the server, which gave the log a perfect stack — of this function, inside whichever server chunk webpack
 * had put it in. Every stored report therefore pointed at a file that had nothing to do with the failure, and one
 * of them cost a long hunt through `/calendar` for a fault that was never there.
 */
export async function reportClientErrorAction(message: string, digest: string | null, path: string, builds?: { build: string; server: string | null }, stack?: string | null): Promise<void> {
  const extra = { digest, path, ...(builds ?? {}) };
  const err = new Error(message.slice(0, 500));
  // An empty stack is better than a confidently wrong one: say plainly that the browser sent none.
  err.stack = stack ? stack.slice(0, 6000) : `${err.message}\n    (no stack sent by the browser)`;
  try {
    const { profile, family } = await requireSession();
    await logError("client", err, { familyId: family.id, userId: profile.id, meta: extra });
  } catch {
    // Deliberately silent: the only failure here is "nobody is signed in", and the report still lands.
    await logError("client", err, { meta: { ...extra, anonymous: true } });
  }
}

export async function resolveErrorsAction(id: string | null): Promise<void> {
  const { profile } = await requireSession();
  if (!(profile as { is_admin?: boolean }).is_admin) return;
  const admin = createAdminClient();
  let q = admin.from("app_errors").update({ resolved_at: new Date().toISOString() }).is("resolved_at", null);
  if (id) q = q.eq("id", id);
  await q;
  revalidatePath("/parent/admin");
}
