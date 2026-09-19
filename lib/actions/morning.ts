"use server";

import { revalidatePath } from "next/cache";
import { formatInTimeZone } from "date-fns-tz";
import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/dates";
import { schoolDay } from "@/lib/school-day";
import { MORNING_BONUS, READY_POINTS, buildMorning, isChampion, morningWindow } from "@/lib/morning";
import { loadSnapTasks } from "@/lib/snaps/server";
import { snapCounts, type SnapLite } from "@/lib/snaps";
import { pingParents } from "@/lib/notify";

/** "I'm ready, leaving on time": points if it is before the first lesson; the bonus when the whole routine is done. */
export async function morningReadyAction(): Promise<{ error?: string; earned?: number; champion?: boolean }> {
  const { profile, family } = await requireStudent();
  const admin = createAdminClient();
  const today = todayIn(family.timezone);
  const hhmm = formatInTimeZone(new Date(), family.timezone, "HH:mm");
  const [{ data: tt }, { data: off }, tasks, { data: snaps }, { data: prayers }, { data: log }] = await Promise.all([
    admin.from("timetable_entries").select("weekday, subject_name, start_time, end_time").eq("student_id", profile.id),
    admin.from("school_days_off").select("day, label").eq("family_id", family.id).eq("day", today),
    loadSnapTasks(family.id, family.timezone),
    admin.from("snaps").select("task_code, taken_on, status, ai_verdict").eq("student_id", profile.id).in("taken_on", [today, new Date(Date.parse(today + "T00:00:00Z") - 86400000).toISOString().slice(0, 10)]),
    admin.from("prayer_logs").select("prayer, status").eq("student_id", profile.id).eq("log_date", today).eq("prayer", "fajr"),
    admin.from("morning_log").select("id, ready_at, champion_at").eq("student_id", profile.id).eq("day", today).maybeSingle(),
  ]);
  const sd = schoolDay(today, tt ?? [], (off ?? []) as { day: string; label: string | null }[]);
  if (sd.off) return { error: "No school today, so no morning routine. Enjoy the day." };
  const first = sd.lessons[0]?.start_time?.slice(0, 5) ?? null;
  if (morningWindow(hhmm, first) !== "morning") return { error: `“Ready” counts only between 04:30 and the first lesson (${first ?? "08:00"}).` };
  if (log?.ready_at) return { earned: 0, champion: !!log.champion_at };
  const mine = tasks.filter((t) => t.enabled && (t.student_id === null || t.student_id === profile.id));
  const has = (code: string) => mine.some((t) => t.code === code);
  const done = (code: string) => ((snaps ?? []) as SnapLite[]).some((s) => s.task_code === code && snapCounts(s));
  const items = buildMorning({ fajrLogged: (prayers ?? []).some((p) => p.status !== "missed"), bedDone: done("bed"), sandwichDone: done("sandwich"), bagDone: done("bag"), ready: true, hasBedTask: has("bed"), hasSandwichTask: has("sandwich"), hasBagTask: has("bag") });
  const champion = isChampion(items);
  const now = new Date().toISOString();
  await admin.from("morning_log").upsert({ student_id: profile.id, day: today, ready_at: now, champion_at: champion ? now : null }, { onConflict: "student_id,day" });
  let earned = READY_POINTS;
  await admin.from("points_ledger").insert({ student_id: profile.id, delta: READY_POINTS, reason: `Ready for school on time ${today}`, ref_type: "morning", ref_id: profile.id }).then(() => null, () => { earned = 0; });
  if (champion) {
    await admin.from("points_ledger").insert({ student_id: profile.id, delta: MORNING_BONUS, reason: `Morning champion ${today}`, ref_type: "morning-champion", ref_id: profile.id }).then(() => { earned += MORNING_BONUS; }, () => null);
    void pingParents(family.id, `${profile.full_name.split(" ")[0]} · morning champion 🏆`, `Fajr, bed, sandwich, bag and ready before ${first ?? "school"}. +${MORNING_BONUS}`);
  } else {
    void pingParents(family.id, `${profile.full_name.split(" ")[0]} is ready for school`, `${hhmm} · ${items.filter((x) => x.done).length}/${items.length} of the morning routine done`);
  }
  ["/today", "/parent"].forEach((p) => revalidatePath(p));
  return { earned, champion };
}
