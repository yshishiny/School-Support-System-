import { createAdminClient } from "@/lib/supabase/admin";
import { amountFor, mergeKpis, scoreWeek, weekFor, type KpiOverride, type WeekResult } from "@/lib/allowance";
import { dueInstruments, type CheckHistoryRow } from "@/lib/wellbeing";
import { shiftDate, todayIn } from "@/lib/dates";
import type { Family } from "@/lib/types";

export interface WeekStatus extends WeekResult {
  start: string;
  end: string;
  amount: number;
  allowance: number;
  enabled: boolean;
}

/** Live status of a student's current (or a given) allowance week. */
export async function allowanceWeekStatus(studentId: string, family: Pick<Family, "id" | "timezone" | "allowance_enabled" | "allowance_amount" | "allowance_pay_weekday" | "allowance_kpis">, anchorDate?: string): Promise<WeekStatus> {
  const admin = createAdminClient();
  const today = todayIn(family.timezone);
  const { start, end } = weekFor(anchorDate ?? today, family.allowance_pay_weekday);
  const kpis = mergeKpis(family.allowance_kpis as KpiOverride[] | null);
  const [{ data: ticks }, { data: prayers }, { data: checkins }, { data: planned }, { data: wb }] = await Promise.all([
    admin.from("kpi_ticks").select("tick_date, code, value").eq("student_id", studentId).gte("tick_date", start).lte("tick_date", end),
    admin.from("prayer_logs").select("log_date").eq("student_id", studentId).gte("log_date", start).lte("log_date", end),
    admin.from("checkins").select("checkin_date").eq("student_id", studentId).gte("checkin_date", start).lte("checkin_date", end),
    admin.from("quizzes").select("scheduled_for, attempts(submitted_at)").eq("student_id", studentId).not("scheduled_for", "is", null).gte("scheduled_for", start).lte("scheduled_for", today < end ? today : end),
    admin.from("wellbeing_checks").select("instrument, taken_on, band, score").eq("student_id", studentId).gte("taken_on", shiftDate(start, -60)).order("taken_on", { ascending: false }),
  ]);
  const prayerDays: Record<string, number> = {};
  for (const p of prayers ?? []) prayerDays[p.log_date as string] = (prayerDays[p.log_date as string] ?? 0) + 1;
  const plannedRows = (planned ?? []) as { scheduled_for: string; attempts: { submitted_at: string | null }[] }[];
  const history = (wb ?? []) as CheckHistoryRow[];
  // Something was due in this week if, at the start of the week, an instrument was due (using history before the week) …
  const before = history.filter((h) => h.taken_on < start);
  const wellbeingDue = dueInstruments(start, before).length > 0 || dueInstruments(today < end ? today : end, before).length > 0;
  const wellbeingDone = history.some((h) => h.taken_on >= start && h.taken_on <= end);
  const result = scoreWeek({
    kpis,
    start,
    end,
    today,
    ticks: (ticks ?? []) as { tick_date: string; code: string; value: boolean }[],
    prayerDays,
    checkinDates: (checkins ?? []).map((c) => c.checkin_date as string),
    plannedTotal: plannedRows.length,
    plannedAttempted: plannedRows.filter((q) => q.attempts.some((a) => a.submitted_at)).length,
    wellbeingDue,
    wellbeingDone,
  });
  return { ...result, start, end, amount: amountFor(result.score, family.allowance_amount), allowance: family.allowance_amount, enabled: family.allowance_enabled };
}

/** Closes a finished week (the day after pay day or later): stores the result once. Returns the row or null when nothing to close. */
export async function closeAllowanceWeek(studentId: string, family: Pick<Family, "id" | "timezone" | "allowance_enabled" | "allowance_amount" | "allowance_pay_weekday" | "allowance_kpis">) {
  if (!family.allowance_enabled) return null;
  const admin = createAdminClient();
  const today = todayIn(family.timezone);
  const yesterday = shiftDate(today, -1);
  const { end } = weekFor(yesterday, family.allowance_pay_weekday);
  if (end !== yesterday) return null; // the week closed on pay day; we run the morning after
  const status = await allowanceWeekStatus(studentId, family, yesterday);
  const { data: existing } = await admin.from("allowance_weeks").select("id").eq("student_id", studentId).eq("week_start", status.start).maybeSingle();
  if (existing) return null;
  const { data } = await admin
    .from("allowance_weeks")
    .insert({ student_id: studentId, family_id: family.id, week_start: status.start, week_end: status.end, score: status.score, band: status.band, amount: status.amount, breakdown: status.results })
    .select("*")
    .single();
  return data;
}
