"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/ops/log";

/**
 * The browser's error boundary reports a real (non-stale-deploy) failure here. `builds` carries the commit the
 * page was built from and the one answering now: when they match, the fault is genuinely in the code.
 */
export async function reportClientErrorAction(message: string, digest: string | null, path: string, builds?: { build: string; server: string | null }): Promise<void> {
  const extra = { digest, path, ...(builds ?? {}) };
  try {
    const { profile, family } = await requireSession();
    await logError("client", new Error(message.slice(0, 500)), { familyId: family.id, userId: profile.id, meta: extra });
  } catch {
    // Deliberately silent: the only failure here is "nobody is signed in", and the report still lands.
    await logError("client", new Error(message.slice(0, 500)), { meta: { ...extra, anonymous: true } });
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
