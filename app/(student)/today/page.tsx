import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, weekdayOf, hourIn } from "@/lib/dates";
import { computeStreak, levelFor } from "@/lib/points";
import type { PrayerRow } from "@/components/PrayerPill";
import { themeById } from "@/lib/themes";
import { heroChoices } from "@/lib/hero";
import { formatPrayerTime, prayerState, prayerWindows, type PrayerName, type PrayerStatus } from "@/lib/prayers";
import { INSTRUMENTS, dueInstruments, type CheckHistoryRow } from "@/lib/wellbeing";
import { allowanceWeekStatus } from "@/lib/allowance/week";
import { eligibilityHint } from "@/lib/allowance";
import { buildQueue } from "@/lib/today-queue";
import { LayoutA } from "@/components/today/LayoutA";
import { LayoutB } from "@/components/today/LayoutB";
import { LayoutC } from "@/components/today/LayoutC";
import type { TodayData } from "@/components/today/types";
import type { Consequence, TimetableEntry } from "@/lib/types";

export const maxDuration = 60;

const PRAYER_LABEL: Record<PrayerName, string> = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TodayPage() {
  const { profile, family } = await requireStudent();
  if (!profile.tour_seen_at) redirect("/tour");
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const hour = hourIn(family.timezone);

  const [{ data: checkins }, { data: ledger }, { data: timetable }, { count: dueReviews }, { data: logs }, { data: prayers }, { data: planned }, { data: recall }, { data: coach }, { data: wellbeing }, { data: consequences }] = await Promise.all([
    supabase.from("checkins").select("checkin_date").eq("student_id", profile.id).order("checkin_date", { ascending: false }).limit(60),
    supabase.from("points_ledger").select("delta").eq("student_id", profile.id),
    supabase.from("timetable_entries").select("*").eq("student_id", profile.id).order("weekday").order("start_time"),
    supabase.from("review_queue").select("id", { count: "exact", head: true }).eq("student_id", profile.id).lte("due_date", today),
    supabase.from("lesson_logs").select("id").eq("student_id", profile.id).eq("log_date", today).limit(1),
    supabase.from("prayer_logs").select("prayer, status").eq("student_id", profile.id).eq("log_date", today),
    supabase.from("quizzes").select("id, title, scheduled_for, plan_slot, attempts(submitted_at)").eq("student_id", profile.id).not("scheduled_for", "is", null).gte("scheduled_for", shiftDate(today, -6)).lte("scheduled_for", shiftDate(today, 6)).order("scheduled_for"),
    supabase.from("quizzes").select("id, attempts(submitted_at)").eq("student_id", profile.id).eq("recall_date", today),
    supabase.from("coach_reports").select("kid_md, headline, created_at").eq("student_id", profile.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("wellbeing_checks").select("instrument, taken_on, band, score").eq("student_id", profile.id).order("taken_on", { ascending: false }).limit(40),
    supabase.from("consequences").select("*").eq("student_id", profile.id).is("closed_at", null).gte("ends_on", today).order("ends_on"),
  ]);
  const [hero, allowance] = await Promise.all([heroChoices(profile), family.allowance_enabled ? allowanceWeekStatus(profile.id, family).catch(() => null) : Promise.resolve(null)]);

  const lat = family.latitude ?? 30.0444;
  const lng = family.longitude ?? 31.2357;
  const now = new Date();
  const logged = new Map<PrayerName, PrayerStatus>((prayers ?? []).map((p) => [p.prayer as PrayerName, p.status as PrayerStatus]));
  const prayerRows: PrayerRow[] = prayerWindows(today, lat, lng).map((w) => ({ prayer: w.prayer, time: formatPrayerTime(w.start, family.timezone), startMs: w.start.getTime(), state: prayerState(w, now), logged: logged.get(w.prayer) ?? null }));
  const openPrayer = prayerRows.find((r) => r.state === "open" && !r.logged) ?? null;
  const onTimeCount = [...logged.values()].filter((s) => s === "on_time").length;

  type PQ = { id: string; title: string; scheduled_for: string; plan_slot: string | null; attempts: { submitted_at: string | null }[] };
  const plannedRows = (planned ?? []) as PQ[];
  const isDone = (q: PQ) => q.attempts.some((a) => a.submitted_at);
  const week = (timetable ?? []) as TimetableEntry[];
  const todayRows = week.filter((t) => t.weekday === weekdayOf(today));
  const checkinDates = (checkins ?? []).map((c) => c.checkin_date as string);
  const due = dueInstruments(today, (wellbeing ?? []) as CheckHistoryRow[]);
  const queue = buildQueue({
    hourLocal: hour,
    prayerOpen: openPrayer ? { prayer: openPrayer.prayer, label: PRAYER_LABEL[openPrayer.prayer], time: openPrayer.time } : null,
    plannedToday: plannedRows.filter((q) => q.scheduled_for === today).map((q) => ({ id: q.id, title: q.title, done: isDone(q), slot: q.plan_slot })),
    catchup: plannedRows.filter((q) => q.scheduled_for < today && !isDone(q)).map((q) => ({ id: q.id, title: q.title })),
    checkinDone: checkinDates.includes(today),
    classesToday: todayRows.length,
    hasNotes: (logs ?? []).length > 0,
    recallDone: ((recall ?? []) as { attempts: { submitted_at: string | null }[] }[]).some((q) => q.attempts.some((a) => a.submitted_at)),
    dueCheck: due.length ? { id: due[0], title: INSTRUMENTS[due[0]].title, minutes: INSTRUMENTS[due[0]].minutes } : null,
    reviewsDue: dueReviews ?? 0,
    learnerDone: !!profile.learner_profile,
  });

  const balance = (ledger ?? []).reduce((s, r) => s + r.delta, 0);
  const streak = computeStreak(checkinDates, today) || computeStreak(checkinDates, shiftDate(today, -1));
  const theme = themeById(profile.theme);
  const stickers = theme.stickers ?? [theme.emoji];
  const coachLine = coach?.kid_md ? coach.kid_md.replace(/^#+\s.*$/gm, "").replace(/[*_`>#]/g, "").trim().split(/\n+/).find((l: string) => l.trim().length > 20) ?? coach.headline : null;
  const weekDates = [...new Set(plannedRows.map((q) => q.scheduled_for))].sort().filter((d) => d >= shiftDate(today, -3) && d <= shiftDate(today, 3)).slice(0, 5);

  const d: TodayData = {
    firstName: profile.full_name.split(" ")[0],
    avatarEmoji: profile.avatar_emoji,
    avatarUrl: hero.avatar,
    bannerUrl: hero.banner,
    balance,
    level: levelFor(balance),
    streak,
    mascot: stickers[1] ?? theme.emoji,
    stickers,
    tagline: theme.tagline,
    queue,
    totalToday: queue.filter((q) => q.kind !== "done").length,
    prayerRows,
    onTimeCount,
    allowance,
    allowanceTone: allowance ? eligibilityHint(allowance, allowance.allowance).tone : null,
    quizzesDoneWeek: plannedRows.filter((q) => q.scheduled_for <= today && isDone(q)).length,
    todayRows,
    weekStrip: weekDates.map((date) => {
      const mine = plannedRows.filter((q) => q.scheduled_for === date);
      return { label: date === today ? "Today" : SHORT[weekdayOf(date)], done: mine.filter(isDone).length, total: mine.length, isToday: date === today, past: date < today };
    }),
    coachLine,
    consequences: (consequences ?? []) as Consequence[],
    checkinDone: checkinDates.includes(today),
    classesToday: todayRows.length,
  };

  const layout = profile.home_layout ?? "b";
  if (layout === "a") return <LayoutA d={d} />;
  if (layout === "c") return <LayoutC d={d} />;
  return <LayoutB d={d} />;
}
