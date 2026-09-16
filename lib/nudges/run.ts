import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegram } from "@/lib/whatsapp/send";
import { sendPush } from "@/lib/push/server";
import { shiftDate, todayIn, weekdayOf } from "@/lib/dates";
import { weekFor } from "@/lib/allowance";
import { WEEKDAYS } from "@/lib/custody";
import { schoolDay, type DayOff } from "@/lib/school-day";
import { classLogCoverage, type ClassLogRow } from "@/lib/class-log";
import { dueSnapTasks, taskDayState, windowOpen, type SnapLite, type SnapTask } from "@/lib/snaps";
import { computeStreak } from "@/lib/points";
import { DEFAULT_NUDGES, dueNudges, isCatchupDay, type NudgeCode, type NudgeSettings } from "@/lib/nudges";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://school-support-system.vercel.app";

/** Sends whatever reminders are due this hour to every child with Telegram connected. Safe to run hourly. */
export async function sendDueNudges(only?: NudgeCode[]): Promise<Record<string, string[]>> {
  const admin = createAdminClient();
  const results: Record<string, string[]> = {};
  const { data: allKids } = await admin.from("profiles").select("id, family_id, full_name, telegram_chat_id, nudges").eq("role", "student");
  const { data: subs } = await admin.from("push_subscriptions").select("user_id");
  const withPush = new Set((subs ?? []).map((x) => x.user_id as string));
  const kids = (allKids ?? []).filter((k) => withPush.has(k.id) || k.telegram_chat_id);
  if (!kids.length) return results;
  const famIds = [...new Set(kids.map((k) => k.family_id))];
  const { data: fams } = await admin.from("families").select("id, timezone, allowance_pay_weekday").in("id", famIds);
  for (const k of kids) {
    const fam = (fams ?? []).find((f) => f.id === k.family_id);
    if (!fam) continue;
    const tz = fam.timezone;
    const today = todayIn(tz);
    const hourLocal = Number(formatInTimeZone(new Date(), tz, "H"));
    const hhmm = formatInTimeZone(new Date(), tz, "HH:mm");
    const { start: weekStart } = weekFor(today, fam.allowance_pay_weekday);
    const [{ data: sentRows }, { data: tt }, { data: offRows }, { data: checkins }, { data: planned }, { data: logs }, { data: tasks }, { data: snaps }] = await Promise.all([
      admin.from("nudges_sent").select("code").eq("student_id", k.id).eq("day", today),
      admin.from("timetable_entries").select("weekday, subject_name, start_time, end_time").eq("student_id", k.id),
      admin.from("school_days_off").select("day, label").eq("family_id", k.family_id).gte("day", weekStart).lte("day", today),
      admin.from("checkins").select("checkin_date").eq("student_id", k.id).gte("checkin_date", shiftDate(today, -40)),
      admin.from("quizzes").select("id, attempts(submitted_at)").eq("student_id", k.id).eq("scheduled_for", today),
      admin.from("lesson_logs").select("log_date, subject_name, note, homework_given").eq("student_id", k.id).gte("log_date", weekStart),
      admin.from("snap_tasks").select("*").eq("family_id", k.family_id).or(`student_id.is.null,student_id.eq.${k.id}`),
      admin.from("snaps").select("task_code, taken_on, status, ai_verdict").eq("student_id", k.id).eq("taken_on", today),
    ]);
    const already = (sentRows ?? []).map((r) => r.code as string);
    const daysOff = (offRows ?? []) as DayOff[];
    const sd = schoolDay(today, tt ?? [], daysOff);
    const checkinDates = (checkins ?? []).map((c) => c.checkin_date as string);
    const logRows = (logs ?? []) as ClassLogRow[];
    const covToday = classLogCoverage(today, today, tt ?? [], logRows, daysOff.map((d) => d.day));
    const covPast = today > weekStart ? classLogCoverage(weekStart, shiftDate(today, -1), tt ?? [], logRows, daysOff.map((d) => d.day)) : { due: 0, done: 0, days: [], lastMissingDate: null };
    const schoolEnd = sd.lessons.length ? sd.lessons[sd.lessons.length - 1].end_time?.slice(0, 5) ?? "15:00" : "15:00";
    const plannedRows = (planned ?? []) as { id: string; attempts: { submitted_at: string | null }[] }[];
    const snapsOpen = dueSnapTasks(today, (tasks ?? []) as SnapTask[], k.id)
      .filter((t) => t.kind !== "handwriting" && windowOpen(t, hhmm) && ["due", "rejected"].includes(taskDayState(t, (snaps ?? []) as SnapLite[], today, hhmm)))
      .map((t) => t.label.toLowerCase());
    const missedCheckins = Array.from({ length: 6 }, (_, n) => shiftDate(today, -1 - n)).filter((d) => d >= weekStart && !checkinDates.includes(d)).length;
    const settings = { ...DEFAULT_NUDGES, ...((k.nudges ?? {}) as Partial<NudgeSettings>) };
    const wd = weekdayOf(today);
    let due = dueNudges(
      {
        firstName: k.full_name.split(" ")[0],
        hourLocal,
        weekday: wd,
        schoolOff: sd.off,
        lessons: sd.lessons,
        checkinDone: checkinDates.includes(today),
        streak: computeStreak(checkinDates, shiftDate(today, -1)),
        quizzesToday: plannedRows.length,
        quizzesDone: plannedRows.filter((q) => q.attempts.some((a) => a.submitted_at)).length,
        classesToLog: hhmm >= schoolEnd ? covToday.due - covToday.done : 0,
        snapsOpen,
        missedCheckins: isCatchupDay(wd, fam.allowance_pay_weekday) ? missedCheckins : 0,
        missedClasses: isCatchupDay(wd, fam.allowance_pay_weekday) ? covPast.due - covPast.done : 0,
        weekClosesLabel: WEEKDAYS[fam.allowance_pay_weekday],
        appUrl: APP_URL,
      },
      settings,
      already,
    );
    if (only) due = due.filter((n) => only.includes(n.code));
    for (const n of due) {
      const body = n.text.replace(` ${APP_URL}`, "");
      const url = n.code === "morning" ? "/today" : "/checkin";
      const push = withPush.has(k.id) ? await sendPush(k.id, { title: n.code === "morning" ? "Today's plan" : n.code === "lastcall" ? "Last call" : n.code === "catchup" ? "Before the week closes" : "Evening round", body, url, tag: n.code }) : { sent: 0, total: 0 };
      const tg = k.telegram_chat_id ? await sendTelegram(k.telegram_chat_id, n.text) : { ok: false, channel: "telegram" as const };
      const ok = push.sent > 0 || tg.ok;
      if (ok) await admin.from("nudges_sent").insert({ student_id: k.id, day: today, code: n.code });
      (results[k.full_name] ??= []).push(`${n.code}: ${ok ? `sent (push ${push.sent}${tg.ok ? ", telegram" : ""})` : push.error ?? "failed"}`);
    }
  }
  return results;
}
