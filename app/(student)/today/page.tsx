import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, weekdayOf, prettyDate } from "@/lib/dates";
import { computeStreak, levelFor } from "@/lib/points";
import { CheckinForm } from "@/components/CheckinForm";
import { AddAssignmentForm } from "@/components/AddAssignmentForm";
import { PracticeButton } from "@/components/LearnButtons";
import { PrayerPill, type PrayerRow } from "@/components/PrayerPill";
import { WeekPlanCard } from "@/components/WeekPlanCard";
import type { PlannedQuiz } from "@/lib/plan/prepare";
import { buildLessonDays } from "@/lib/lessons";
import ReactMarkdown from "react-markdown";
import { INSTRUMENTS, dueInstruments, type CheckHistoryRow } from "@/lib/wellbeing";
import { themeById } from "@/lib/themes";
import { subjectEmoji } from "@/lib/plan";
import { formatPrayerTime, prayerState, prayerWindows, type PrayerName, type PrayerStatus } from "@/lib/prayers";
import Link from "next/link";
import { KIND_EMOJI, type Assignment, type Checkin, type CheckinItem, type ItemStatus, type Subject, type TimetableEntry } from "@/lib/types";

export const maxDuration = 300;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function TodayPage() {
  const { profile, family } = await requireStudent();
  if (!profile.tour_seen_at) redirect("/tour");
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const weekAhead = shiftDate(today, 7);

  const [{ data: open }, { data: checkins }, { data: ledger }, { data: subjects }, { data: timetable }, { count: dueReviews }, { data: logs }, { data: prayers }, { data: planned }, { data: topics }, { data: coach }, { data: wellbeing }] = await Promise.all([
    supabase.from("assignments").select("*").eq("student_id", profile.id).eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("checkins").select("*, checkin_items(*)").eq("student_id", profile.id).order("checkin_date", { ascending: false }),
    supabase.from("points_ledger").select("delta").eq("student_id", profile.id),
    supabase.from("subjects").select("*").eq("student_id", profile.id).order("name"),
    supabase.from("timetable_entries").select("*").eq("student_id", profile.id).order("weekday").order("start_time"),
    supabase.from("review_queue").select("id", { count: "exact", head: true }).eq("student_id", profile.id).lte("due_date", today),
    supabase.from("lesson_logs").select("log_date, subject_name, note, topic_id").eq("student_id", profile.id).gte("log_date", shiftDate(today, -30)).order("log_date"),
    supabase.from("prayer_logs").select("prayer, status").eq("student_id", profile.id).eq("log_date", today),
    supabase
      .from("quizzes")
      .select("id, title, scheduled_for, plan_slot, topic_id, act_section, topics(subject), attempts(score, total, submitted_at)")
      .eq("student_id", profile.id)
      .not("scheduled_for", "is", null)
      .gte("scheduled_for", shiftDate(today, -6))
      .lte("scheduled_for", shiftDate(today, 6))
      .order("scheduled_for"),
    supabase.from("topics").select("id, subject, name, unit, sort").eq("track", "school").eq("grade", profile.grade ?? 0).order("subject").order("sort"),
    supabase.from("coach_reports").select("kid_md, created_at").eq("student_id", profile.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("wellbeing_checks").select("instrument, taken_on, band, score").eq("student_id", profile.id).order("taken_on", { ascending: false }).limit(40),
  ]);
  const dueChecks = dueInstruments(today, (wellbeing ?? []) as CheckHistoryRow[]);
  const daysToExam = profile.target_exam_date ? Math.ceil((new Date(profile.target_exam_date).getTime() - new Date(today).getTime()) / 86400000) : null;

  // Timetable: today's classes, or the next school day when today is free.
  const week = (timetable ?? []) as TimetableEntry[];
  const todayWd = weekdayOf(today);
  const todayRows = week.filter((t) => t.weekday === todayWd);
  let nextDay: { name: string; rows: TimetableEntry[] } | null = null;
  for (let i = 1; i <= 7 && !nextDay; i++) {
    const wd = (todayWd + i) % 7;
    const rows = week.filter((t) => t.weekday === wd);
    if (rows.length) nextDay = { name: i === 1 ? "Tomorrow" : DAY_NAMES[wd], rows };
  }
  const allLogs = (logs ?? []) as { log_date: string; subject_name: string; note: string; topic_id: string | null }[];
  const lessonDays = buildLessonDays({ today, timetable: week, topics: topics ?? [], logs: allLogs });
  const existingNotes: Record<string, string> = {};
  allLogs.filter((l) => l.log_date === today).forEach((l) => (existingNotes[l.subject_name] = l.note));
  const hasNotes = Object.keys(existingNotes).length > 0;

  // Prayers: real Cairo times, on-time window enforced server-side when logging.
  const now = new Date();
  const lat = family.latitude ?? 30.0444;
  const lng = family.longitude ?? 31.2357;
  const loggedPrayers = new Map<PrayerName, PrayerStatus>((prayers ?? []).map((p) => [p.prayer as PrayerName, p.status as PrayerStatus]));
  const prayerRows: PrayerRow[] = prayerWindows(today, lat, lng).map((w) => ({
    prayer: w.prayer,
    time: formatPrayerTime(w.start, family.timezone),
    startMs: w.start.getTime(),
    state: prayerState(w, now),
    logged: loggedPrayers.get(w.prayer) ?? null,
  }));
  const theme = themeById(profile.theme);
  const onTimeCount = [...loggedPrayers.values()].filter((s) => s === "on_time").length;

  const assignments = (open ?? []) as Assignment[];
  const dueNow = assignments.filter((a) => a.due_date !== null && a.due_date <= today);
  const upcoming = assignments.filter((a) => a.due_date && a.due_date > today && a.due_date <= weekAhead);
  const tests = upcoming.filter((a) => a.kind === "quiz" || a.kind === "exam");

  const allCheckins = (checkins ?? []) as (Checkin & { checkin_items: CheckinItem[] })[];
  const todays = allCheckins.find((c) => c.checkin_date === today) ?? null;
  const existingItems: Record<string, ItemStatus> = {};
  todays?.checkin_items.forEach((i) => (existingItems[i.assignment_id] = i.status));
  const streak = computeStreak(allCheckins.map((c) => c.checkin_date), today) || computeStreak(allCheckins.map((c) => c.checkin_date), shiftDate(today, -1));
  const balance = (ledger ?? []).reduce((s, r) => s + r.delta, 0);
  const lvl = levelFor(balance);

  return (
    <main className="space-y-4">
      <header className="card space-y-3 relative overflow-hidden">
        <div className="pointer-events-none absolute -right-2 -bottom-3 text-6xl opacity-25 select-none sticker-still" aria-hidden>{(theme.stickers ?? [theme.emoji])[1] ?? theme.emoji}</div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="ring h-16 w-16 shrink-0 rounded-full p-[3px]" style={{ ["--pct" as string]: (lvl.into / lvl.span) * 100 }}>
              <div className="h-full w-full rounded-full bg-panel flex items-center justify-center text-3xl">{profile.avatar_emoji}</div>
            </div>
            <div className="min-w-0">
              <div className="h1 truncate leading-tight">Hey {profile.full_name.split(" ")[0]} <span className="sticker text-2xl align-middle">{theme.emoji}</span></div>
              <div className="text-xs muted truncate">{theme.tagline} · Level {lvl.level} · {lvl.into}/{lvl.span} XP</div>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <Link href="/tour" className="badge" title="Tour">❓</Link>
            <PrayerPill rows={prayerRows} onTimeCount={onTimeCount} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="badge text-base"><b className="text-accent-2">{balance}</b> ⭐</span>
          <span className="badge text-base">{streak} 🔥</span>
          <span className="badge"><b className="text-accent-2">{lvl.level}</b> 🏅 level</span>
          {daysToExam !== null && <span className="badge muted">{profile.target_exam ?? "Exam"} in {daysToExam}d</span>}
        </div>
      </header>

      {!(profile as { learner_profile?: unknown }).learner_profile && (
        <Link href="/me/about-me" className="card flex items-center gap-3 border-accent/50">
          <span className="text-4xl sticker">🦸</span>
          <div className="flex-1">
            <div className="font-bold">Tell your coach about you</div>
            <div className="text-xs muted">10 quick questions, no wrong answers. +15 pts.</div>
          </div>
          <span className="btn-primary btn-sm">Go</span>
        </Link>
      )}

      {balance < 100 && (
        <Link href="/me#guide" className="card flex items-center gap-3 border-accent-2/50">
          <span className="text-4xl sticker-still">🏆</span>
          <div className="flex-1">
            <div className="font-bold">How to win points fast</div>
            <div className="text-xs muted">Prayers +25, check-in +35, practice up to +60, streaks up to +250. See the routine.</div>
          </div>
          <span className="btn-ghost btn-sm">Guide</span>
        </Link>
      )}

      {week.length > 0 && (
        <section className="card">
          <h2 className="h2 mb-2">{todayRows.length ? `Today at school · ${prettyDate(today)}` : `No classes today (${DAY_NAMES[todayWd]})`}</h2>
          {todayRows.length > 0 && <TimetableList rows={todayRows} />}
          {!todayRows.length && nextDay && (
            <>
              <p className="text-sm muted mb-1">{nextDay.name}:</p>
              <TimetableList rows={nextDay.rows} />
            </>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-sm muted">Full week</summary>
            <div className="mt-2 space-y-2">
              {[0, 1, 2, 3, 4, 5, 6]
                .filter((wd) => week.some((t) => t.weekday === wd))
                .map((wd) => (
                  <div key={wd}>
                    <div className={`text-sm font-semibold ${wd === todayWd ? "text-accent-2" : ""}`}>{DAY_NAMES[wd]}</div>
                    <TimetableList rows={week.filter((t) => t.weekday === wd)} />
                  </div>
                ))}
            </div>
          </details>
        </section>
      )}

      {dueChecks.length > 0 && (
        <Link href={`/coach/check/${dueChecks[0]}`} className="card flex items-center gap-3 border-accent/50">
          <span className="text-4xl sticker-still">{INSTRUMENTS[dueChecks[0]].emoji}</span>
          <div className="flex-1">
            <div className="font-bold">{INSTRUMENTS[dueChecks[0]].title} with your coach</div>
            <div className="text-xs muted">{INSTRUMENTS[dueChecks[0]].minutes} min · private · +5 pts{dueChecks.length > 1 ? ` · ${dueChecks.length - 1} more waiting` : ""}</div>
          </div>
          <span className="btn-primary btn-sm">Go</span>
        </Link>
      )}

      {coach?.kid_md && (
        <section className="card border-accent/50 space-y-1">
          <div className="flex items-center justify-between">
            <h2 className="h2">🦸 Your coach says</h2>
            <span className="text-[11px] muted">{prettyDate(String(coach.created_at).slice(0, 10))}</span>
          </div>
          <div className="prose-lesson text-sm"><ReactMarkdown>{coach.kid_md}</ReactMarkdown></div>
        </section>
      )}

      <WeekPlanCard quizzes={((planned ?? []) as unknown as PlannedQuiz[]).map((q) => ({ ...q, subject: q.topics?.subject ?? null }))} today={today} />

      {hasNotes && (
        <section className="card flex items-center gap-3 border-accent/50">
          <span className="text-4xl sticker-still">🤔</span>
          <div className="flex-1">
            <div className="font-bold">Recall quiz on today's lessons</div>
            <div className="text-xs muted">{Object.keys(existingNotes).join(", ")}</div>
          </div>
          <PracticeButton recall label="Start" className="btn-primary btn-sm" />
        </section>
      )}

      {tests.length > 0 && (
        <section className="card border-warn/40">
          <h2 className="h2 mb-2">🎯 Coming up</h2>
          <ul className="space-y-1 text-sm">
            {tests.map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span>{KIND_EMOJI[t.kind]} {t.title}{t.subject_name ? ` · ${t.subject_name}` : ""}</span>
                <span className="muted shrink-0">{prettyDate(t.due_date!)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href={(dueReviews ?? 0) > 0 ? "/review" : "/learn"} className="card flex items-center gap-3">
        <span className="text-4xl sticker-still">🧠</span>
        <div className="flex-1">
          <div className="font-bold">{(dueReviews ?? 0) > 0 ? `${dueReviews} questions to review` : "Practise 10 minutes"}</div>
          <div className="text-xs muted">
            {(dueReviews ?? 0) > 0 ? "Missed questions, back at the right time." : "Pick a topic from today's lessons and do one set."}
            {profile.target_exam === "ACT" && daysToExam !== null ? ` · ACT in ${daysToExam} days` : ""}
          </div>
        </div>
        <span className="btn-ghost btn-sm">Go</span>
      </Link>

      <CheckinForm items={dueNow} today={today} existing={todays} existingItems={existingItems} lessonDays={lessonDays} />

      <details className="card">
        <summary className="cursor-pointer font-semibold">➕ Teacher gave new homework? Add it</summary>
        <div className="mt-3">
          <AddAssignmentForm subjects={(subjects ?? []) as Subject[]} defaultDate={shiftDate(today, 1)} compact />
        </div>
      </details>
    </main>
  );
}

function TimetableList({ rows }: { rows: TimetableEntry[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {rows.map((t) => (
        <li key={t.id} className="flex gap-3">
          <span className="muted w-24 shrink-0">{t.start_time.slice(0, 5)}{t.end_time ? `–${t.end_time.slice(0, 5)}` : ""}</span>
          <span className="font-medium"><span className="mr-1">{subjectEmoji(t.subject_name)}</span>{t.subject_name}</span>
          {t.room && <span className="muted truncate">{t.room}</span>}
        </li>
      ))}
    </ul>
  );
}
