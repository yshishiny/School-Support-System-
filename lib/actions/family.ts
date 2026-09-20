"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { failed } from "@/lib/ops/fault";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/dates";

const PATHS = ["/parent", "/parent/settings", "/parent/reports"];

/** The parent's own card: how the kids call them, and a WhatsApp number for delivery. */
export async function updateParentProfileAction(_prev: { error?: string; ok?: string } | undefined, formData: FormData): Promise<{ error?: string; ok?: string }> {
  const { profile } = await requireParent();
  const supabase = await createClient();
  const label = String(formData.get("parent_label") ?? "").trim().slice(0, 24) || null;
  const whatsapp = String(formData.get("whatsapp") ?? "").replace(/[^\d]/g, "") || null;
  const fullName = String(formData.get("full_name") ?? "").trim().slice(0, 80) || profile.full_name;
  const { error } = await supabase.from("profiles").update({ parent_label: label, whatsapp, full_name: fullName, live_pings: formData.get("live_pings") === "on" }).eq("id", profile.id);
  if (error) return failed("actions.family.updateParentProfile", error);
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: "Saved." };
}

async function baseUrl(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/** Creates a one-use invite link for a co-parent. Valid 14 days. */
export async function createInviteAction(_prev: { error?: string; link?: string } | undefined, formData: FormData): Promise<{ error?: string; link?: string }> {
  const { family, profile } = await requireParent();
  const supabase = await createClient();
  const label = String(formData.get("label") ?? "").trim().slice(0, 24) || null;
  const { data, error } = await supabase.from("family_invites").insert({ family_id: family.id, created_by: profile.id, label }).select("token").single();
  if (error || !data) return failed("actions.family.createInvite", error, "Could not create the invite.");
  revalidatePath("/parent/settings");
  return { link: `${await baseUrl()}/join/${data.token}` };
}

export async function revokeInviteAction(id: string): Promise<void> {
  const { family } = await requireParent();
  const supabase = await createClient();
  await supabase.from("family_invites").delete().eq("id", id).eq("family_id", family.id).is("used_at", null);
  revalidatePath("/parent/settings");
}

/** Weekly custody pattern: which parent has the kids on each weekday ("" = both / shared). */
export async function saveCustodyPatternAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const supabase = await createClient();
  const { data: parents } = await supabase.from("profiles").select("id").eq("family_id", family.id).eq("role", "parent");
  const valid = new Set((parents ?? []).map((p) => p.id));
  const pattern: Record<string, string | null> = {};
  for (let d = 0; d <= 6; d += 1) {
    const v = String(formData.get(`day_${d}`) ?? "");
    pattern[String(d)] = valid.has(v) ? v : null;
  }
  await supabase.from("families").update({ custody_pattern: pattern }).eq("id", family.id);
  PATHS.forEach((p) => revalidatePath(p));
}

/** One-off change for a date: "this Thursday they are with Mum". Empty parent = shared that day. */
export async function setCustodyOverrideAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const supabase = await createClient();
  const day = String(formData.get("day") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const parentId = String(formData.get("parent_id") ?? "") || null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 120) || null;
  if (formData.get("remove") === "1") {
    await supabase.from("custody_overrides").delete().eq("family_id", family.id).eq("day", day);
  } else {
    await supabase.from("custody_overrides").upsert({ family_id: family.id, day, parent_id: parentId, note }, { onConflict: "family_id,day" });
  }
  PATHS.forEach((p) => revalidatePath(p));
}

/** Removes a co-parent's account from the family (their login is deleted). Cannot remove yourself. */
export async function removeParentAction(parentId: string): Promise<void> {
  const { family, profile } = await requireParent();
  if (parentId === profile.id) return;
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role, family_id").eq("id", parentId).maybeSingle();
  if (!target || target.family_id !== family.id || target.role !== "parent") return;
  await admin.auth.admin.deleteUser(parentId);
  PATHS.forEach((p) => revalidatePath(p));
}

/** Convenience for the home page: today's date in the family's zone. */
export async function familyToday(): Promise<string> {
  const { family } = await requireParent();
  return todayIn(family.timezone);
}

/** Inbox: mark one or every notification read. */
export async function markNotificationsReadAction(id: string | null): Promise<void> {
  const { profile } = await requireParent();
  const supabase = await createClient();
  let q = supabase.from("parent_notifications").update({ read_at: new Date().toISOString() }).eq("parent_id", profile.id).is("read_at", null);
  if (id) q = q.eq("id", id);
  await q;
  revalidatePath("/parent/notifications");
  revalidatePath("/parent");
}

/** Parent home layout: a (command centre), b (kid-first) or c (day timeline). */
export async function setParentHomeLayoutAction(formData: FormData): Promise<void> {
  const { profile } = await requireParent();
  const layout = String(formData.get("home_layout") ?? "b");
  if (!["a", "b", "c"].includes(layout)) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ home_layout: layout }).eq("id", profile.id);
  revalidatePath("/parent");
  revalidatePath("/parent/settings");
}
