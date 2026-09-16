import Link from "next/link";
import { redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, weekdayOf, hourIn } from "@/lib/dates";
import { computeStreak, levelFor } from "@/lib/points";
import { PrayerPill, type PrayerRow } from "@/components/PrayerPill";
import { NowCard } from "@/components/NowCard";
import { ConsequenceCard } from "@/components/ConsequenceCard";
import { themeById } from "@/lib/themes";
import { heroChoices } from "@/lib/hero";
import { subjectEmoji } from "@/lib/plan";
import { formatPrayerTime, prayerState, prayerWindows, type PrayerName, type PrayerStatus } from "@/lib/prayers";
import { INSTRUMENTS, dueInstruments, type CheckHistoryRow } from "@/lib/wellbeing";
import { allowanceWeekStatus } from "@/lib/allowance/week";
import { eligibilityHint } from "@/lib/allowance";
import { buildQueue } from "@/lib/today-queue";
import type { Consequence, TimetableEntry } from "@/lib/types";

export const maxDuration = 60;

const PRAYER_LABEL: Record<PrayerName, string> = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };

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
    supabase.from("quizzes").select("id, title, scheduled_for, plan_slot, attempts(submitted_at)").eq("student_id", profile.id).not("scheduled_for", "is", null).gte("scheduled_for", shiftDate(today, -6)).lte("scheduled_for", today).order("scheduled_for"),
    supabase.from("quizzes").select("id, attempts(submitted_at)").eq("student_id", profile.id).eq("recall_date", today),
    supabase.from("coach_reports").select("kid_md, headline, created_at").eq("student_id", profile.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("wellbeing_checks").select("instrument, taken_on, band, score").eq("student_id", profile.id).order("taken_on", { ascending: false }).limit(40),
    supabase.from("consequences").select("*").eq("student_id", profile.id).is("closed_at", null).gte("ends_on", today).order("ends_on"),
  ]);
  const [hero, allowance] = await Promise.all([heroChoices(profile), family.allowance_enabled ? allowanceWeekStatus(profile.id, family).catch(() => null) : Promise.resolve(null)]);

  // Prayers
  const lat = family.latitude ?? 30.0444;
  const lng = family.longitude ?? 31.2357;
  const now = new Date();
  const logged = new Map<PrayerName, PrayerStatus>((prayers ?? []).map((p) => [p.prayer as PrayerName, p.status as PrayerStatus]));
  const prayerRows: PrayerRow[] = prayerWindows(today, lat, lng).map((w) => ({ prayer: w.prayer, time: formatPrayerTime(w.start, family.timezone), startMs: w.start.getTime(), state: prayerState(w, now), logged: logged.get(w.prayer) ?? null }));
  const openPrayer = prayerRows.find((r) => r.state === "open" && !r.logged) ?? null;
  const onTimeCount = [...logged.values()].filter((s) => s === "on_time").length;

  // Queue
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
  const [nowItem, ...rest] = queue;
  const totalToday = queue.filter((q) => q.kind !== "done").length;

  // Numbers
  const balance = (ledger ?? []).reduce((s, r) => s + r.delta, 0);
  const streak = computeStreak(checkinDates, today) || computeStreak(checkinDates, shiftDate(today, -1));
  const lvl = levelFor(balance);
  const theme = themeById(profile.theme);
  const mascot = (theme.stickers ?? [theme.emoji])[1] ?? theme.emoji;
  const quizzesDoneWeek = plannedRows.filter(isDone).length;
  const coachLine = coach?.kid_md ? coach.kid_md.replace(/^#+\s.*$/m, "").replace(/[*_`>#]/g, "").trim().split(/\n+/).find((l: string) => l.trim().length > 20) ?? coach.headline : null;

  return (
    <main className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center gap-2.5">
        <Link href="/me" className="shrink-0 ring h-11 w-11 rounded-full p-[2px]" style={{ ["--pct" as string]: (lvl.into / lvl.span) * 100 }}>
          {hero.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero.avatar} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <div className="h-full w-full rounded-full bg-panel flex items-center justify-center text-xl">{profile.avatar_emoji}</div>
          )}
        </Link>
        <div className="h2 flex-1 truncate leading-tight">{profile.full_name.split(" ")[0]}</div>
        <Link href="/rewards" className="badge text-sm"><b className="text-accent-2">{balance.toLocaleString()}</b> ★</Link>
        <PrayerPill rows={prayerRows} onTimeCount={onTimeCount} />
      </div>

      <ConsequenceCard items={(consequences ?? []) as Consequence[]} />

      {/* The one thing */}
      <NowCard item={nowItem} index={0} total={totalToday} mascot={mascot} />

      {/* Up next */}
      {rest.length > 0 && (
        <section className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider muted px-1" style={{ fontFamily: "var(--font-display)" }}>Up next</div>
          {rest.slice(0, 4).map((it) => (
            <Link key={it.key} href={it.href ?? "#"} className="card !py-3 flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${it.kind === "quiz" ? "bg-accent" : it.kind === "checkin" ? "bg-good" : it.kind === "prayer" ? "bg-warn" : "bg-accent-2"}`} />
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate" style={{ fontFamily: "var(--font-display)" }}>{it.title}</div>
                <div className="text-xs muted truncate">{it.subtitle}{it.chips.length ? ` · ${it.chips[0]}` : ""}</div>
              </div>
              <span className="text-muted">›</span>
            </Link>
          ))}
        </section>
      )}

      {/* This week: money, streak, quizzes in one bar */}
      <section className="card space-y-2">
        <div className="flex items-center gap-2">
          <div className="h2 flex-1">This week</div>
          {allowance ? (
            <div className="font-bold text-accent-2" style={{ fontFamily: "var(--font-display)" }}>{allowance.amount} EGP · {eligibilityHint(allowance, allowance.allowance).tone === "good" ? "on track" : eligibilityHint(allowance, allowance.allowance).tone === "warn" ? "at risk" : "gone"}</div>
          ) : (
            <div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>Level {lvl.level}</div>
          )}
        </div>
        <div className="h-2.5 rounded-full bg-panel-2 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${allowance ? allowance.score : Math.round((lvl.into / lvl.span) * 100)}%`, background: "linear-gradient(90deg, var(--color-good), var(--color-accent))" }} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs muted">
          {allowance && <span>Score {allowance.score} · day {allowance.elapsedDays}/7</span>}
          <span>Streak {streak} 🔥</span>
          <span>{quizzesDoneWeek} quiz{quizzesDoneWeek === 1 ? "" : "zes"} done</span>
          <span>{onTimeCount}/5 prayers on time</span>
          {allowance && <Link href="/rewards" className="underline">details</Link>}
        </div>
      </section>

      {/* Today at school: one scrolling row */}
      {todayRows.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 px-0.5">
          {todayRows.map((t) => (
            <span key={t.id} className="badge shrink-0">{subjectEmoji(t.subject_name)} {t.start_time.slice(0, 5)} {t.subject_name}</span>
          ))}
        </div>
      )}

      {/* Coach bubble */}
      {coachLine && (
        <Link href="/coach?tab=plan" className="flex items-end gap-2.5">
          <span className="text-3xl sticker-still">🦸</span>
          <div className="flex-1 rounded-2xl rounded-bl-md border-2 border-accent/40 bg-accent/10 px-3 py-2 text-sm leading-snug">
            <div className="prose-lesson"><ReactMarkdown>{coachLine}</ReactMarkdown></div>
          </div>
        </Link>
      )}

      <div className="flex justify-center gap-4 text-xs muted pt-1">
        <Link href="/checkin">Check-in page</Link>
        <Link href="/learn?tab=me">This week&apos;s quizzes</Link>
        <Link href="/tour">Tour</Link>
      </div>
    </main>
  );
}
