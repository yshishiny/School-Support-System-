"use server";

import { revalidatePath } from "next/cache";
import { requireParent, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_KPIS, PRACTICES, practiceByCode } from "@/lib/allowance";
import { shiftDate, todayIn } from "@/lib/dates";

const PATHS = ["/parent", "/parent/allowance", "/today"];

export async function saveAllowanceSettingsAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const supabase = await createClient();
  const kpis = DEFAULT_KPIS.map((k) => ({ code: k.code, weight: Math.max(0, Math.min(50, Number(formData.get(`weight_${k.code}`) ?? k.weight) || 0)), enabled: formData.get(`on_${k.code}`) === "on" }));
  await supabase
    .from("families")
    .update({
      allowance_enabled: formData.get("enabled") === "on",
      allowance_amount: Math.max(0, Math.min(10000, Number(formData.get("amount") ?? 250) || 0)),
      allowance_pay_weekday: Math.max(0, Math.min(6, Number(formData.get("pay_weekday") ?? 4))),
      allowance_kpis: kpis,
      practices_enabled: PRACTICES.map((p) => p.code).filter((c) => formData.get(`practice_${c}`) === "on"),
    })
    .eq("id", family.id);
  PATHS.forEach((p) => revalidatePath(p));
}

/** Parent's daily tap: ✓ or ✗ for a parent-judged KPI. Tapping the same value again clears it. */
export async function tickKpiAction(studentId: string, code: string, value: boolean, date?: string): Promise<void> {
  const { family } = await requireParent();
  const supabase = await createClient();
  const day = date ?? todayIn(family.timezone);
  const { data: existing } = await supabase.from("kpi_ticks").select("id, value").eq("student_id", studentId).eq("tick_date", day).eq("code", code).maybeSingle();
  if (existing && existing.value === value) await supabase.from("kpi_ticks").delete().eq("id", existing.id);
  else await supabase.from("kpi_ticks").upsert({ student_id: studentId, family_id: family.id, tick_date: day, code, value }, { onConflict: "student_id,tick_date,code" });
  PATHS.forEach((p) => revalidatePath(p));
}

export async function markAllowancePaidAction(weekId: string): Promise<void> {
  const { family } = await requireParent();
  const supabase = await createClient();
  await supabase.from("allowance_weeks").update({ paid_at: new Date().toISOString() }).eq("id", weekId).eq("family_id", family.id);
  PATHS.forEach((p) => revalidatePath(p));
}

export async function assignConsequenceAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const studentId = String(formData.get("student_id") ?? "");
  const code = String(formData.get("code") ?? "");
  const def = practiceByCode(code);
  if (!def || !studentId) return;
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const days = Math.max(1, Math.min(14, Number(formData.get("days") ?? def.days) || def.days));
  await supabase.from("consequences").insert({
    student_id: studentId,
    family_id: family.id,
    code,
    label: def.label,
    reason: String(formData.get("reason") ?? "").trim().slice(0, 300) || null,
    starts_on: today,
    ends_on: shiftDate(today, days - 1),
    earn_back_task: String(formData.get("earn_back") ?? "").trim().slice(0, 300) || def.earnBack,
  });
  PATHS.forEach((p) => revalidatePath(p));
}

export async function closeConsequenceAction(id: string, earnedBack: boolean): Promise<void> {
  const { family } = await requireParent();
  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase.from("consequences").update({ closed_at: now, earned_back_at: earnedBack ? now : null }).eq("id", id).eq("family_id", family.id);
  PATHS.forEach((p) => revalidatePath(p));
}

/** The child says the earn-back task is done; a parent confirms. */
export async function claimEarnBackAction(id: string): Promise<void> {
  const { profile } = await requireStudent();
  const supabase = await createClient();
  await supabase.from("consequences").update({ student_claimed_at: new Date().toISOString() }).eq("id", id).eq("student_id", profile.id);
  PATHS.forEach((p) => revalidatePath(p));
}
