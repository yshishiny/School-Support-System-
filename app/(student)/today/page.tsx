import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, weekdayOf, prettyDate } from "@/lib/dates";
import { computeStreak, levelFor } from "@/lib/points";
import { CheckinForm } from "@/components/CheckinForm";
import { AddAssignmentForm } from "@/components/AddAssignmentForm";
import { PracticeButton } from "@/components/LearnButtons";
import { PrayerPill, type PrayerRow } from "@/components/PrayerPill";
import { themeById } from "@/lib/themes";
import { formatPrayerTime, prayerState, prayerWindows, type PrayerName, type PrayerStatus } from "@/lib/prayers";
import Link from "next/link";
import { KIND_EMOJI, type Assignment, type Checkin, type CheckinItem, type ItemStatus, type Subject, type TimetableEntry } from "@/lib/types";

export const maxDuration = 300;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SKIP_SUBJECTS = /^(p\.?e\.?|music|art|line)$/i;

export default async function TodayPage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const weekAhead = shiftDate(today, 7);

  const [{ data: open }, { data: checkins }, { data: ledger }, { data: subjects }, { data: timetable }, { count: dueReviews }, { data: logs }, { data: prayers }] = await Promise.all([
    supabase.from("assignments").select("*").eq("student_id", profile.id).eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("checkins").select("*, checkin_items(*)").eq("student_id", profile.id).order("checkin_date", { ascending: false }),
    supabase.from("points_ledger").select("delta").eq("student_id", profile.id),
    supabase.from("subjects").select("*").eq("student_id", profile.id).order("name"),
    supabase.from("timetable_entries").select("*").eq("student_id", profile.id).order("weekday").order("start_time"),
    supabase.from("review_queue").select("id", { count: "exact", head: true }).eq("student_id", profile.id).lte("due_date", today),
    supabase.from("lesson_logs").select("subject_name, note").eq("student_id", profile.id).eq("log_date", today),
    supabase.from("prayer_logs").select("prayer, status").eq("student_id", profile.id).eq("log_date", today),
  ]);
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
  const todaySubjects = [...new Set(todayRows.map((t) => t.subject_name))].filter((n) => !SKIP_SUBJECTS.test(n.trim()));
  const existingNotes: Record<string, string> = {};
  (logs ?? []).forEach((l) => (existingNotes[l.subject_name] = l.note));
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
      <header className="card space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="ring h-14 w-14 shrink-0 rounded-full p-[3px]" style={{ ["--pct" as string]: (lvl.into / lvl.span) * 100 }}>
              <div className="h-full w-full rounded-full bg-panel flex items-center justify-center text-2xl">{profile.avatar_emoji}</div>
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-lg truncate">Hey {profile.full_name.split(" ")[0]} {theme.emoji}</div>
              <div className="text-xs muted truncate">{theme.tagline} · Level {lvl.level} · {lvl.into}/{lvl.span} XP</div>
            </div>
          </div>
          <PrayerPill rows={prayerRows} onTimeCount={onTimeCount} />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="badge"><b className="text-accent-2">{balance}</b> ⭐ points</span>
          <span className="badge">{streak} 🔥 streak</span>
          {daysToExam !== null && <span className="badge muted">{profile.target_exam ?? "Exam"} in {daysToExam}d</span>}
        </div>
      </header>

      {balance < 100 && (
        <Link href="/me#guide" className="card flex items-center gap-3 border-accent-2/50">
          <span className="text-3xl">🏆</span>
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

      {hasNotes && (
        <section className="card flex items-center gap-3 border-accent/50">
          <span className="text-3xl">🧠</span>
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
        <span className="text-3xl">🧠</span>
        <div className="flex-1">
          <div className="font-bold">{(dueReviews ?? 0) > 0 ? `${dueReviews} questions to review` : "Practise 10 minutes"}</div>
          <div className="text-xs muted">
            {(dueReviews ?? 0) > 0 ? "Missed questions, back at the right time." : "Pick a topic from today's lessons and do one set."}
            {profile.target_exam === "ACT" && daysToExam !== null ? ` · ACT in ${daysToExam} days` : ""}
          </div>
        </div>
        <span className="btn-ghost btn-sm">Go</span>
      </Link>

      <CheckinForm items={dueNow} today={today} existing={todays} existingItems={existingItems} todaySubjects={todaySubjects} existingNotes={existingNotes} />

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
          <span className="font-medium">{t.subject_name}</span>
          {t.room && <span className="muted truncate">{t.room}</span>}
        </li>
      ))}
    </ul>
  );
}
