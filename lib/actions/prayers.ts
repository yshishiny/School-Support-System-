"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRAYERS, PRAYER_POINTS, prayerLogDate, prayerPoints, prayerState, prayerWindows, type PrayerName } from "@/lib/prayers";

export interface PrayerResult {
  error?: string;
  status?: "on_time" | "late";
  earned?: number;
}

/** The student taps "Prayed": the server decides on time vs late from real prayer times. */
export async function logPrayerAction(prayer: PrayerName): Promise<PrayerResult> {
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
  const { data: row, error } = await admin.from("prayer_logs").insert({ student_id: profile.id, log_date: logDate, prayer, status, logged_at: now.toISOString() }).select("id").single();
  if (error || !row) return { error: error?.message ?? "Could not save." };

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
  revalidatePath("/today");
  revalidatePath("/parent");
  return { status, earned };
}
