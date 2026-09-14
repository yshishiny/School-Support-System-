import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, weekdayOf, prettyDate } from "@/lib/dates";
import { computeStreak, levelFor } from "@/lib/points";
import { CheckinForm } from "@/components/CheckinForm";
import { AddAssignmentForm } from "@/components/AddAssignmentForm";
import Link from "next/link";
import { KIND_EMOJI, type Assignment, type Checkin, type CheckinItem, type ItemStatus, type Subject, type TimetableEntry } from "@/lib/types";

export default async function TodayPage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const weekAhead = shiftDate(today, 7);

  const [{ data: open }, { data: checkins }, { data: ledger }, { data: subjects }, { data: timetable }, { count: dueReviews }] = await Promise.all([
    supabase.from("assignments").select("*").eq("student_id", profile.id).eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("checkins").select("*, checkin_items(*)").eq("student_id", profile.id).order("checkin_date", { ascending: false }),
    supabase.from("points_ledger").select("delta").eq("student_id", profile.id),
    supabase.from("subjects").select("*").eq("student_id", profile.id).order("name"),
    supabase.from("timetable_entries").select("*").eq("student_id", profile.id).eq("weekday", weekdayOf(today)).order("start_time"),
    supabase.from("review_queue").select("id", { count: "exact", head: true }).eq("student_id", profile.id).lte("due_date", today),
  ]);
  const daysToExam = profile.target_exam_date ? Math.ceil((new Date(profile.target_exam_date).getTime() - new Date(today).getTime()) / 86400000) : null;

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
      <header className="card flex items-center gap-3">
        <div className="text-4xl">{profile.avatar_emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg truncate">Hey {profile.full_name.split(" ")[0]} 👋</div>
          <div className="flex items-center gap-2 text-xs muted">
            <span>Level {lvl.level}</span>
            <div className="h-1.5 flex-1 rounded-full bg-panel-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${(lvl.into / lvl.span) * 100}%` }} />
            </div>
            <span>{lvl.into}/{lvl.span}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold text-accent-2">{balance} ⭐</div>
          <div className="text-xs muted">{streak}🔥 streak</div>
        </div>
      </header>

      {(timetable ?? []).length > 0 && (
        <section className="card">
          <h2 className="h2 mb-2">Today at school · {prettyDate(today)}</h2>
          <ul className="space-y-1 text-sm">
            {(timetable as TimetableEntry[]).map((t) => (
              <li key={t.id} className="flex gap-3">
                <span className="muted w-24 shrink-0">{t.start_time.slice(0, 5)}{t.end_time ? `–${t.end_time.slice(0, 5)}` : ""}</span>
                <span className="font-medium">{t.subject_name}</span>
                {t.room && <span className="muted">{t.room}</span>}
              </li>
            ))}
          </ul>
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

      <CheckinForm items={dueNow} today={today} existing={todays} existingItems={existingItems} />

      <details className="card">
        <summary className="cursor-pointer font-semibold">➕ Teacher gave new homework? Add it</summary>
        <div className="mt-3">
          <AddAssignmentForm subjects={(subjects ?? []) as Subject[]} defaultDate={shiftDate(today, 1)} compact />
        </div>
      </details>
    </main>
  );
}
