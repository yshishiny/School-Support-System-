"use server";

import { failed, report } from "@/lib/ops/fault";
import { weekFor } from "@/lib/allowance";
import { openCompensation } from "@/lib/compensation/run";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRAYERS, PRAYER_POINTS, allAtMosque, fajrMosqueStreak, fajrWeekEarned, pastPrayerPoints, prayerLogDate, prayerPoints, prayerState, prayerWindows, schoolSpan, windowAtSchool, countsAsCongregation, type PastClaim, type PrayerName } from "@/lib/prayers";
import { shiftDate, todayIn } from "@/lib/dates";

export interface PrayerResult {
  error?: string;
  status?: "on_time" | "late";
  earned?: number;
}

/** The student taps "Prayed": the server decides on time vs late from real prayer times. */
/**
 * The congregation bonuses, paid once each by a deterministic reference: five at the mosque in a day, and every
 * completed week of Fajr at the mosque. Never throws; a bonus that cannot be written leaves the prayer saved.
 */
async function awardMosqueBonuses(studentId: string, logDate: string): Promise<number> {
  const admin = createAdminClient();
  let earned = 0;
  try {
    const { data: rows } = await admin.from("prayer_logs").select("id, log_date, prayer, at_mosque").eq("student_id", studentId).gte("log_date", shiftDate(logDate, -40)).lte("log_date", logDate);
    const logs = (rows ?? []) as { id: string; log_date: string; prayer: string; at_mosque: boolean }[];
    if (allAtMosque(logs, logDate)) {
      const anchor = logs.filter((l) => l.log_date === logDate && l.at_mosque).map((l) => l.id).sort()[0];
      const { error } = await admin.from("points_ledger").insert({ student_id: studentId, delta: PRAYER_POINTS.ALL_AT_MOSQUE_BONUS, reason: `All five prayers at the mosque on ${logDate}`, ref_type: "prayer_mosque_day", ref_id: anchor });
      if (!error) earned += PRAYER_POINTS.ALL_AT_MOSQUE_BONUS;
    }
    const streak = fajrMosqueStreak(logs, logDate);
    if (fajrWeekEarned(streak)) {
      const anchor = logs.find((l) => l.log_date === logDate && l.prayer === "fajr" && l.at_mosque)?.id;
      if (anchor) {
        const { error } = await admin.from("points_ledger").insert({ student_id: studentId, delta: PRAYER_POINTS.FAJR_MOSQUE_WEEK_BONUS, reason: `${streak / 7} week${streak === 7 ? "" : "s"} of Fajr at the mosque`, ref_type: "prayer_fajr_week", ref_id: anchor });
        if (!error) earned += PRAYER_POINTS.FAJR_MOSQUE_WEEK_BONUS;
      }
    }
  } catch (err) {
    // The prayer is saved; a bonus is not worth failing the tap, but a bonus that never paid is worth knowing.
    await report("prayers.mosqueBonus", err, { userId: studentId, meta: { logDate } });
  }
  return earned;
}

export async function logPrayerAction(prayer: PrayerName, atMosque = false): Promise<PrayerResult> {
  const { profile, family } = await requireStudent();
  if (!PRAYERS.includes(prayer)) return { error: "Unknown prayer." };
  const now = new Date();
  const lat = family.latitude ?? 30.0444;
  const lng = family.longitude ?? 31.2357;
  const logDate = prayerLogDate(prayer, now, family.timezone, lat, lng);
  const window = prayerWindows(logDate, lat, lng).find((w) => w.prayer === prayer)!;
  const state = prayerState(window, now);
  if (state === "not_yet") return { error: "It is not time for this prayer yet." };
  const status = state === "open" ? "on_time" : "late";

  const admin = createAdminClient();
  const { data: existing } = await admin.from("prayer_logs").select("id").eq("student_id", profile.id).eq("log_date", logDate).eq("prayer", prayer).maybeSingle();
  if (existing) return { error: "Already logged." };
  const mosque = countsAsCongregation(status, atMosque);
  const { data: row, error } = await admin.from("prayer_logs").insert({ student_id: profile.id, log_date: logDate, prayer, status, logged_at: now.toISOString(), at_mosque: mosque }).select("id").single();
  if (error || !row) return failed("actions.prayers.logPrayer", error, "Could not save.");

  let earned = 0;
  const { error: pErr } = await admin.from("points_ledger").insert({
    student_id: profile.id,
    delta: prayerPoints(status),
    reason: `${prayer[0].toUpperCase() + prayer.slice(1)} prayer ${status === "on_time" ? "on time" : "(late)"}`,
    ref_type: "prayer",
    ref_id: row.id,
  });
  if (!pErr) earned += prayerPoints(status);

  // All five on time today: one bonus, keyed to a deterministic row id so it never pays twice.
  const { data: dayLogs } = await admin.from("prayer_logs").select("id, status").eq("student_id", profile.id).eq("log_date", logDate);
  if (dayLogs && dayLogs.length === 5 && dayLogs.every((l) => l.status === "on_time")) {
    const anchor = [...dayLogs.map((l) => l.id)].sort()[0];
    const { error: bErr } = await admin.from("points_ledger").insert({
      student_id: profile.id,
      delta: PRAYER_POINTS.ALL_ON_TIME_BONUS,
      reason: "All five prayers on time",
      ref_type: "prayer_bonus",
      ref_id: anchor,
    });
    if (!bErr) earned += PRAYER_POINTS.ALL_ON_TIME_BONUS;
  }
  if (mosque) earned += await awardMosqueBonuses(profile.id, logDate);
  revalidatePath("/today");
  revalidatePath("/parent");
  return { status, earned };
}

/**
 * A prayer whose window already closed (today or yesterday), reported honestly afterwards:
 * on time (full points when the window fell in school hours, otherwise 2), late (1), or missed (1 for honesty).
 * The parent sees "logged later" next to it.
 *
 * Congregation can be claimed here too, and it has to be: nobody stops at the mosque door to open the app, so
 * almost every mosque prayer in this house is logged hours later. Only an *on time* claim can be at the mosque —
 * a prayer already missed was not prayed in congregation — and the entry still has to be balanced like any other
 * late one before it counts for the allowance.
 */
export async function logPastPrayerAction(prayer: PrayerName, date: string, claim: PastClaim, atMosque = false): Promise<PrayerResult> {
  const { profile, family } = await requireStudent();
  if (!PRAYERS.includes(prayer) || !["on_time", "late", "missed"].includes(claim)) return { error: "Unknown prayer." };
  const today = todayIn(family.timezone);
  const weekStart = weekFor(today, family.allowance_pay_weekday).start;
  if (date > today || date < weekStart) return { error: "Only days of this allowance week can be filled in." };
  const lat = family.latitude ?? 30.0444;
  const lng = family.longitude ?? 31.2357;
  const window = prayerWindows(date, lat, lng).find((w) => w.prayer === prayer)!;
  if (prayerState(window, new Date()) !== "late_only") return { error: "That prayer's time is still open: log it normally." };
  const admin = createAdminClient();
  const { data: existing } = await admin.from("prayer_logs").select("id").eq("student_id", profile.id).eq("log_date", date).eq("prayer", prayer).maybeSingle();
  if (existing) return { error: "Already logged." };
  const { data: tt } = await admin.from("timetable_entries").select("weekday, start_time, end_time").eq("student_id", profile.id);
  const atSchool = claim === "on_time" && windowAtSchool(window, schoolSpan(date, tt ?? []), family.timezone);
  const status = claim;
  const mosque = countsAsCongregation(claim, atMosque);
  const { data: row, error } = await admin
    .from("prayer_logs")
    .insert({ student_id: profile.id, log_date: date, prayer, status, logged_at: new Date().toISOString(), entered_late: true, at_mosque: mosque, claim: atSchool ? "school" : "other" })
    .select("id")
    .single();
  if (error || !row) return failed("actions.prayers.logPastPrayer", error, "Could not save.");
  const delta = pastPrayerPoints(claim, atSchool);
  let earned = 0;
  const where = mosque ? "on time at the mosque (logged later)" : atSchool ? "on time at school" : "on time (logged later)";
  const reason = claim === "missed" ? `${prayer[0].toUpperCase() + prayer.slice(1)}: missed, said honestly` : `${prayer[0].toUpperCase() + prayer.slice(1)} prayer ${claim === "on_time" ? where : "(late)"}`;
  const { error: pErr } = await admin.from("points_ledger").insert({ student_id: profile.id, delta, reason, ref_type: "prayer", ref_id: row.id });
  if (!pErr) earned = delta;
  // The day's congregation bonuses are worked out from the whole day, so filling in the last one late still pays.
  if (mosque) earned += await awardMosqueBonuses(profile.id, date);
  // A prayer reported later counts for the allowance once it is balanced: two ayahs read, one question right.
  // Built after the answer goes back, because it fetches the verses and the child should not watch a dead button.
  if (claim !== "missed") after(() => openCompensation(profile.id, family.id, "prayer", `prayer:${date}:${prayer}`, `${prayer[0].toUpperCase() + prayer.slice(1)} on ${date}, reported later`));
  ["/today", "/parent", "/me", "/allowance"].forEach((p) => revalidatePath(p));
  return { status: status as "on_time" | "late", earned };
}
