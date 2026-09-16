"use server";

import { revalidatePath } from "next/cache";
import { requireParent, requireSession, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createRewardAction(_prev: { error?: string } | undefined, formData: FormData) {
  const { family } = await requireParent();
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const cost = Number(formData.get("cost_points") ?? 0);
  const kind = String(formData.get("kind") ?? "privilege");
  const cash = Number(formData.get("cash_amount_egp") ?? 0) || null;
  if (!title || !(cost > 0)) return { error: "Title and a positive points cost are required." };
  const { error } = await supabase.from("rewards").insert({
    family_id: family.id,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    kind,
    cost_points: cost,
    cash_amount_egp: kind === "cash" ? cash : null,
    emoji: String(formData.get("emoji") ?? "🎁").trim() || "🎁",
  });
  if (error) return { error: error.message };
  revalidatePath("/parent/rewards");
  revalidatePath("/rewards");
  return {};
}

export async function toggleRewardAction(formData: FormData) {
  await requireParent();
  const supabase = await createClient();
  await supabase
    .from("rewards")
    .update({ active: formData.get("active") === "true" })
    .eq("id", String(formData.get("id")));
  revalidatePath("/parent/rewards");
  revalidatePath("/rewards");
}

export async function redeemRewardAction(_prev: { error?: string; ok?: string } | undefined, formData: FormData) {
  const { profile } = await requireStudent();
  const supabase = await createClient();
  const rewardId = String(formData.get("reward_id"));
  const { data: reward } = await supabase.from("rewards").select("*").eq("id", rewardId).eq("active", true).single();
  if (!reward) return { error: "That reward is not available." };

  const available = await availablePoints(profile.id);
  if (available < reward.cost_points) return { error: `You need ${reward.cost_points - available} more points.` };

  const { error } = await supabase
    .from("redemptions")
    .insert({ student_id: profile.id, reward_id: rewardId, points_spent: reward.cost_points });
  if (error) return { error: error.message };
  revalidatePath("/rewards");
  revalidatePath("/parent");
  return { ok: `Requested ${reward.title}. Waiting for approval.` };
}

export async function decideRedemptionAction(formData: FormData) {
  await requireParent();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision")); // approved | rejected | delivered
  const { data: r } = await supabase.from("redemptions").select("*, rewards(title)").eq("id", id).single();
  if (!r) return;
  await supabase.from("redemptions").update({ status: decision, decided_at: new Date().toISOString() }).eq("id", id);
  if (decision === "approved" && r.status === "pending") {
    const admin = createAdminClient();
    await admin.from("points_ledger").insert({
      student_id: r.student_id,
      delta: -r.points_spent,
      reason: `Redeemed: ${(r as { rewards?: { title?: string } }).rewards?.title ?? "reward"}`,
      ref_type: "redemption",
      ref_id: id,
    });
  }
  revalidatePath("/parent/rewards");
  revalidatePath("/parent");
  revalidatePath("/rewards");
}

export async function adjustPointsAction(formData: FormData) {
  await requireParent();
  const supabase = await createClient();
  const delta = Number(formData.get("delta") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!delta || !reason) return;
  await supabase.from("points_ledger").insert({ student_id: String(formData.get("student_id")), delta, reason, ref_type: "manual" });
  revalidatePath("/parent");
  revalidatePath("/parent/rewards");
}

/** Balance minus points held by pending redemption requests. */
export async function availablePoints(studentId: string): Promise<number> {
  await requireSession();
  const supabase = await createClient();
  const [{ data: ledger }, { data: pending }] = await Promise.all([
    supabase.from("points_ledger").select("delta").eq("student_id", studentId),
    supabase.from("redemptions").select("points_spent").eq("student_id", studentId).eq("status", "pending"),
  ]);
  const balance = (ledger ?? []).reduce((s, r) => s + r.delta, 0);
  const held = (pending ?? []).reduce((s, r) => s + r.points_spent, 0);
  return balance - held;
}

import { REWARD_TEMPLATES } from "@/lib/reward-templates";

/** One-tap enable of a reward template into the family's catalog. */
export async function enableRewardTemplateAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const key = String(formData.get("key") ?? "");
  const t = REWARD_TEMPLATES.find((x) => x.key === key);
  if (!t) return;
  const supabase = await createClient();
  const { data: dup } = await supabase.from("rewards").select("id").eq("family_id", family.id).eq("title", t.title).maybeSingle();
  if (dup) return;
  await supabase.from("rewards").insert({ family_id: family.id, title: t.title, description: t.description, kind: t.kind, cost_points: t.cost_points, cash_amount_egp: t.cash_amount_egp ?? null, emoji: t.emoji });
  revalidatePath("/parent/rewards");
  revalidatePath("/rewards");
}
