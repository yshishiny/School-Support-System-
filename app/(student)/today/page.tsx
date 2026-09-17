import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, weekdayOf, hourIn } from "@/lib/dates";
import { formatInTimeZone } from "date-fns-tz";
import { dueSnapTasks, taskDayState, windowOpen, type SnapLite } from "@/lib/snaps";
import { loadSnapTasks } from "@/lib/snaps/server";
import { classLogCoverage, missingLine, type ClassLogRow } from "@/lib/class-log";
import { weekFor } from "@/lib/allowance";
import { isBirthday, ageOn } from "@/lib/people";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeStreak, levelFor } from "@/lib/points";
import type { PrayerRow } from "@/components/PrayerPill";
import { themeById } from "@/lib/themes";
import { heroChoices } from "@/lib/hero";
import { formatPrayerTime, prayerState, prayerWindows, type PrayerName, type PrayerStatus } from "@/lib/prayers";
import { INSTRUMENTS, dueInstruments, type CheckHistoryRow } from "@/lib/wellbeing";
import { allowanceWeekStatus } from "@/lib/allowance/week";
import { eligibilityHint } from "@/lib/allowance";
import { buildQueue } from "@/lib/today-queue";
import { ensureFollowups } from "@/lib/followups/run";
import { loadCompensations } from "@/lib/compensation/run";
import { materialStages, nextStage } from "@/lib/materials/study";
import { loadRevisions } from "@/lib/revision/run";
import { prettyDate } from "@/lib/dates";
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
    supabase.from("prayer_logs").select("prayer, status, entered_late, log_date").eq("student_id", profile.id).in("log_date", [today, shiftDate(today, -1)]),
    supabase.from("quizzes").select("id, title, scheduled_for, plan_slot, attempts(submitted_at)").eq("student_id", profile.id).not("scheduled_for", "is", null).gte("scheduled_for", shiftDate(today, -6)).lte("scheduled_for", shiftDate(today, 6)).order("scheduled_for"),
    supabase.from("quizzes").select("id, attempts(submitted_at)").eq("student_id", profile.id).eq("recall_date", today),
    supabase.from("coach_reports").select("kid_md, headline, created_at").eq("student_id", profile.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("wellbeing_checks").select("instrument, taken_on, band, score").eq("student_id", profile.id).order("taken_on", { ascending: false }).limit(40),
    supabase.from("consequences").select("*").eq("student_id", profile.id).is("closed_at", null).gte("ends_on", today).order("ends_on"),
  ]);
  const [hero, allowance, snapTasks, { data: snapRows }] = await Promise.all([
    heroChoices(profile),
    family.allowance_enabled ? allowanceWeekStatus(profile.id, family).catch(() => null) : Promise.resolve(null),
    loadSnapTasks(family.id),
    supabase.from("snaps").select("task_code, taken_on, status, ai_verdict").eq("student_id", profile.id).eq("taken_on", today).order("created_at"),
  ]);
  const hhmm = formatInTimeZone(new Date(), family.timezone, "HH:mm");
  const { start: weekStart, end: weekEnd } = weekFor(today, family.allowance_pay_weekday);
  const [{ data: weekLogs }, { data: offRows }] = await Promise.all([
    supabase.from("lesson_logs").select("log_date, subject_name, note, homework_given").eq("student_id", profile.id).gte("log_date", weekStart).lt("log_date", today),
    supabase.from("school_days_off").select("day").eq("family_id", family.id).gte("day", weekStart).lte("day", weekEnd),
  ]);
  const coverage = today > weekStart ? classLogCoverage(weekStart, shiftDate(today, -1), (timetable ?? []) as { weekday: number; subject_name: string }[], (weekLogs ?? []) as ClassLogRow[], (offRows ?? []).map((d) => d.day as string)) : null;
  const classLogMissing = coverage && coverage.due > coverage.done ? { count: coverage.due - coverage.done, line: missingLine(coverage.days), deadline: SHORT[weekdayOf(weekEnd)] } : null;
  const snapsDue = dueSnapTasks(today, snapTasks, profile.id)
    .filter((t) => windowOpen(t, hhmm) && ["due", "rejected"].includes(taskDayState(t, (snapRows ?? []) as SnapLite[], today, hhmm)))
    .map((t) => ({ id: t.id, label: t.label, emoji: t.emoji }));

  const lat = family.latitude ?? 30.0444;
  const lng = family.longitude ?? 31.2357;
  const now = new Date();
  type PL = { prayer: string; status: string; entered_late: boolean; log_date: string };
  const yesterdayDate = shiftDate(today, -1);
  const logged = new Map<PrayerName, PL>(((prayers ?? []) as PL[]).filter((p) => p.log_date === today).map((p) => [p.prayer as PrayerName, p]));
  const loggedY = new Map<PrayerName, PL>(((prayers ?? []) as PL[]).filter((p) => p.log_date === yesterdayDate).map((p) => [p.prayer as PrayerName, p]));
  const prayerRows: PrayerRow[] = prayerWindows(today, lat, lng).map((w) => ({ prayer: w.prayer, time: formatPrayerTime(w.start, family.timezone), startMs: w.start.getTime(), state: prayerState(w, now), logged: (logged.get(w.prayer)?.status as PrayerStatus | undefined) ?? null, enteredLate: logged.get(w.prayer)?.entered_late ?? false }));
  const yesterdayRows: PrayerRow[] = prayerWindows(yesterdayDate, lat, lng).map((w) => ({ prayer: w.prayer, time: formatPrayerTime(w.start, family.timezone), startMs: w.start.getTime(), state: prayerState(w, now), logged: (loggedY.get(w.prayer)?.status as PrayerStatus | undefined) ?? null, enteredLate: loggedY.get(w.prayer)?.entered_late ?? false }));
  const openPrayer = prayerRows.find((r) => r.state === "open" && !r.logged) ?? null;
  const onTimeCount = [...logged.values()].filter((p) => p.status === "on_time").length;

  type PQ = { id: string; title: string; scheduled_for: string; plan_slot: string | null; attempts: { submitted_at: string | null }[] };
  const plannedRows = (planned ?? []) as PQ[];
  const isDone = (q: PQ) => q.attempts.some((a) => a.submitted_at);
  const week = (timetable ?? []) as TimetableEntry[];
  const todayRows = week.filter((t) => t.weekday === weekdayOf(today));
  const checkinDates = (checkins ?? []).map((c) => c.checkin_date as string);
  const { data: cpRows } = await supabase.from("checkpoints").select("id, quiz_id, kind, subject, time_limit_min, due_by, quizzes(title, attempts(submitted_at))").eq("student_id", profile.id).eq("status", "ready").gte("due_by", today).order("created_at", { ascending: false }).limit(3);
  type CP = { id: string; quiz_id: string | null; kind: string; subject: string | null; time_limit_min: number; due_by: string; quizzes: { title: string; attempts: { submitted_at: string | null }[] } | null };
  const cp = ((cpRows ?? []) as unknown as CP[]).find((c) => c.quiz_id && !c.quizzes?.attempts?.some((a) => a.submitted_at)) ?? null;
  const { data: cpCount } = cp ? await supabase.from("quiz_questions").select("id").eq("quiz_id", cp.quiz_id!) : { data: [] };
  const checkpoint = cp ? { quizId: cp.quiz_id!, title: cp.quizzes?.title ?? (cp.kind === "weekly" ? "Weekly checkpoint" : `Spot check · ${cp.subject}`), questions: (cpCount ?? []).length, minutes: cp.time_limit_min, dueLabel: SHORT[weekdayOf(cp.due_by)] } : null;
  const checkinsMissed = Array.from({ length: 6 }, (_, k) => shiftDate(today, -1 - k)).filter((d) => d >= weekStart && !checkinDates.includes(d)).reverse().map((d) => ({ date: d, label: d === shiftDate(today, -1) ? "Yesterday" : SHORT[weekdayOf(d)] }));
  const due = dueInstruments(today, (wellbeing ?? []) as CheckHistoryRow[]);
  const followupsOpen = (await ensureFollowups(profile.id, family.id, today, family.timezone, family.allowance_pay_weekday).catch(() => [])).filter((r) => !r.answer).length;
  const compensationsOpen = (await loadCompensations(profile.id, shiftDate(today, -14)).catch(() => [])).filter((c) => !c.correct).length;
  const [{ data: matRows }, { data: matQuizRows }, revisionRows] = await Promise.all([
    supabase.from("materials").select("id, title, created_at").eq("student_id", profile.id).eq("status", "ready").gte("created_at", `${shiftDate(today, -21)}T00:00:00Z`),
    supabase.from("quizzes").select("material_id, attempts(submitted_at)").eq("student_id", profile.id).not("material_id", "is", null).gte("created_at", `${shiftDate(today, -21)}T00:00:00Z`),
    loadRevisions([profile.id], 6).catch(() => []),
  ]);
  const matAttempts = ((matQuizRows ?? []) as { material_id: string; attempts: { submitted_at: string | null }[] }[]);
  const materialsDue = ((matRows ?? []) as { id: string; title: string; created_at: string }[])
    .map((m) => ({ m, st: nextStage(materialStages(m.created_at.slice(0, 10), matAttempts.filter((q) => q.material_id === m.id).flatMap((q) => q.attempts.filter((a) => a.submitted_at).map((a) => a.submitted_at!.slice(0, 10))), today)) }))
    .filter((x) => x.st)
    .sort((a, b) => a.st!.dueBy.localeCompare(b.st!.dueBy))
    .map((x) => ({ id: x.m.id, title: x.m.title, stage: x.st!.label, dueBy: prettyDate(x.st!.dueBy), overdue: x.st!.state === "overdue" }));
  const revisionQuizIds = revisionRows.filter((r) => r.status === "ready" && r.quiz_id).map((r) => r.quiz_id!);
  const { data: revAttempts } = revisionQuizIds.length ? await supabase.from("attempts").select("quiz_id").in("quiz_id", revisionQuizIds).not("submitted_at", "is", null) : { data: [] as { quiz_id: string }[] };
  const satIds = new Set((revAttempts ?? []).map((a) => a.quiz_id));
  const revisionsOpen = revisionRows.filter((r) => r.status === "ready" && r.quiz_id && !satIds.has(r.quiz_id)).map((r) => ({ id: r.id, subject: r.subject }));
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
    snapsDue,
    followups: followupsOpen,
    compensations: compensationsOpen,
    materialsDue,
    revisions: revisionsOpen,
    classLogMissing,
    checkinsMissed,
    checkpoint,
  });

  const birthday = isBirthday(profile.birth_date, today);
  if (birthday) {
    // One gift per birthday: the unique (student, ref_type, ref_id) index makes repeats a no-op.
    await createAdminClient().from("points_ledger").insert({ student_id: profile.id, delta: 50, reason: `Happy birthday ${today.slice(0, 4)} 🎂`, ref_type: `birthday-${today.slice(0, 4)}`, ref_id: profile.id }).then(() => null, () => null);
  }
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
    banner: { fit: profile.banner_fit ?? "full", zoom: Number(profile.banner_zoom ?? 1) || 1, x: profile.banner_x ?? 50, y: profile.banner_y ?? 30 },
    balance,
    level: levelFor(balance),
    streak,
    mascot: stickers[1] ?? theme.emoji,
    stickers,
    tagline: birthday ? `🎂 Happy birthday, ${profile.full_name.split(" ")[0]}! ${ageOn(profile.birth_date, today) ?? ""} today. +50 ★ from all of us.` : theme.tagline,
    queue,
    totalToday: queue.filter((q) => q.kind !== "done").length,
    prayerRows,
    yesterdayRows,
    today,
    yesterdayDate,
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

  const snapBanner = snapsDue.length > 0 && (
    <Link href="/snaps" className="card flex items-center gap-3 border-2 border-accent bg-accent/10 pop">
      <span className="text-4xl sticker-still">📸</span>
      <div className="flex-1 min-w-0">
        <div className="font-bold">{snapsDue.length} snap{snapsDue.length === 1 ? "" : "s"} waiting now: {snapsDue.map((t) => `${t.emoji} ${t.label}`).join(" · ")}</div>
        <div className="text-xs muted">Show your win before the time window closes. Counts for your allowance.</div>
      </div>
      <span className="btn-primary btn-sm shrink-0">Snap</span>
    </Link>
  );
  const layout = profile.home_layout ?? "b";
  if (layout === "a") return <>{snapBanner}<LayoutA d={d} /></>;
  if (layout === "c") return <>{snapBanner}<LayoutC d={d} /></>;
  return <>{snapBanner}<LayoutB d={d} /></>;
}
