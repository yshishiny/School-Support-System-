import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, prettyDate } from "@/lib/dates";
import { dueSnapTasks, handwritingScore, isRota, ownsTask, rotaTurnEnds, snapDaysDone, taskDayState, windowOpen, type DayState, type HandwritingAnalysis, type SnapLite, type SnapTask } from "@/lib/snaps";
import { weekFor } from "@/lib/allowance";
import { loadSnapTasks, signSnapUrls } from "@/lib/snaps/server";
import { SnapCapture } from "@/components/SnapCapture";

export const maxDuration = 60;

const STATE_LINE: Record<DayState, { text: string; tone: string }> = {
  due: { text: "Waiting for your snap", tone: "muted" },
  closed: { text: "Time window passed for today", tone: "muted" },
  sent: { text: "Sent · a parent will check", tone: "text-warn" },
  good: { text: "Looks good ✅ · waiting for a parent's tick", tone: "text-good" },
  approved: { text: "Approved by a parent ✔️", tone: "text-good" },
  rejected: { text: "Sent back · try again", tone: "text-bad" },
};

/** "Show your win": today's snap tasks and the handwriting corner. */
export default async function SnapsPage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const hhmm = formatInTimeZone(new Date(), family.timezone, "HH:mm");
  const [tasks, { data: snapRows }] = await Promise.all([
    loadSnapTasks(family.id, family.timezone),
    supabase.from("snaps").select("id, task_code, kind, path, taken_on, status, ai_verdict, ai_note, ai_detail, review_note, created_at, rater_verdict, rater_note").eq("student_id", profile.id).gte("taken_on", shiftDate(today, -60)).order("created_at"),
  ]);
  type Row = SnapLite & { id: string; kind: string; path: string; ai_note: string | null; ai_detail: (Partial<HandwritingAnalysis> & { score?: number }) | null; review_note: string | null; created_at: string; rater_note?: string | null };
  const snaps = (snapRows ?? []) as Row[];
  const due = dueSnapTasks(today, tasks, profile.id);
  const dailyTasks = due.filter((t) => t.kind !== "handwriting");
  const hwTask = tasks.find((t) => t.kind === "handwriting" && t.enabled && (t.student_id === null || t.student_id === profile.id)) ?? null;
  const hwSamples = snaps.filter((s) => s.kind === "handwriting" && s.ai_detail?.score !== undefined);
  const lastHw = hwSamples[hwSamples.length - 1] ?? null;
  const hwUrls = await signSnapUrls(hwSamples.slice(-2).map((s) => ({ id: s.id, path: s.path })));
  const hwDueToday = !!hwTask && due.some((t) => t.id === hwTask.id);
  const week = weekFor(today, family.allowance_pay_weekday ?? 5);
  const weekDays: string[] = [];
  for (let d = week.start; d <= today; d = shiftDate(d, 1)) weekDays.push(d);
  const mine = tasks.filter((t) => t.enabled && (isRota(t) ? (t.rota_student_ids ?? []).includes(profile.id) : t.student_id === null || t.student_id === profile.id));
  const meter = mine.map((t) => ({ t, ...snapDaysDone(t, snaps, weekDays, profile.id) })).filter((m) => m.due > 0);
  // A chore shared with a brother: who has it now, and when it comes back.
  const shared = mine.filter((t) => isRota(t));
  const { data: kidRows } = await supabase.from("profiles").select("id, full_name").eq("family_id", family.id).eq("role", "student");
  const firstName = (id: string) => ((kidRows ?? []).find((k) => k.id === id)?.full_name ?? "").split(" ")[0] || "your brother";
  const rotaLines = shared.map((t: SnapTask) => {
    const ends = rotaTurnEnds(t, today)!;
    const mineNow = ownsTask(t, profile.id, today);
    return { id: t.id, emoji: t.emoji, label: t.label, mineNow, lastDay: ends.lastDay, next: ends.next === profile.id ? "you" : firstName(ends.next) };
  });
  const weekDue = meter.reduce((s, m) => s + m.due, 0);
  const weekDone = meter.reduce((s, m) => s + m.done, 0);
  const openNow = dailyTasks.filter((t) => windowOpen(t, hhmm) && ["due", "rejected"].includes(taskDayState(t, snaps, today, hhmm)));
  const pendingCount = snaps.filter((s) => s.status === "pending").length;
  // A rater also sees how many of her brothers' pictures are waiting on her.
  const isRater = !!(profile as { rater?: boolean }).rater;
  const { count: toCheck } = isRater
    ? await supabase.from("snaps").select("id", { count: "exact", head: true }).eq("family_id", family.id).neq("student_id", profile.id).eq("status", "pending")
    : { count: 0 };

  return (
    <main className="space-y-4">
      <header className="flex items-center gap-3">
        <span className="text-4xl sticker-still">📸</span>
        <div className="flex-1">
          <h1 className="h1">Show your win</h1>
          <p className="text-sm muted">Snap it, the coach checks it, a parent ticks it. Counts toward your allowance.</p>
        </div>
        <Link href="/today" className="btn-ghost btn-sm">Today</Link>
      </header>

      {isRater && (
        <Link href="/snaps/review" className={`card !py-3 flex items-center gap-3 ${toCheck ? "border-2 border-accent" : ""}`}>
          <span className="text-3xl">🧐</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold">Check your brothers&apos; snaps</div>
            <div className="text-xs muted">{toCheck ? `${toCheck} waiting for your tick` : "Nothing waiting just now"}</div>
          </div>
          <span className="text-muted">›</span>
        </Link>
      )}

      {tasks.length === 0 && <p className="card muted text-sm">No snap tasks yet. Ask a parent to switch some on under Snaps → Tasks.</p>}

      {meter.length > 0 && (
        <section className={`card space-y-2 ${openNow.length ? "border-2 border-accent" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>{openNow.length ? `${openNow.length} to snap now` : "Nothing open right now"}</div>
            <span className="text-xs muted">This week {weekDone}/{weekDue}{pendingCount ? ` · ${pendingCount} waiting for a tick` : ""}</span>
          </div>
          <div className="h-2 rounded-full bg-panel-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${weekDue ? Math.round((weekDone / weekDue) * 100) : 0}%` }} /></div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {meter.map((m) => <span key={m.t.id} className={`chip ${m.done >= m.due ? "text-good" : ""}`}>{m.t.emoji} {m.done}/{m.due}</span>)}
          </div>
          <p className="text-xs muted">{family.snap_ai_check === false ? "A parent or your rater checks each picture and ticks it." : "The coach has a first look in seconds; a parent gives the final tick."} Every due day you snap keeps the allowance meter full.</p>
        </section>
      )}

      {rotaLines.length > 0 && (
        <section className="space-y-2">
          {rotaLines.map((r) => (
            <div key={r.id} className={`card !py-3 flex items-center gap-3 ${r.mineNow ? "border-2 border-accent" : ""}`}>
              <span className="text-3xl">{r.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold">{r.label}</div>
                <div className="text-xs muted">{r.mineNow ? `Your turn until ${prettyDate(r.lastDay)}, then ${r.next}.` : `Not your turn — ${r.next === "you" ? "back to you" : r.next} after ${prettyDate(r.lastDay)}.`}</div>
              </div>
              <span className="text-xs">{r.mineNow ? "🔁 yours" : "🔁 resting"}</span>
            </div>
          ))}
        </section>
      )}

      {dailyTasks.length > 0 && (
        <section className="space-y-2">
          <h2 className="h2">Today · {prettyDate(today)}</h2>
          {dailyTasks.map((t) => {
            const state = taskDayState(t, snaps, today, hhmm);
            const open = windowOpen(t, hhmm);
            const latest = [...snaps].reverse().find((s) => s.task_code === t.code && s.taken_on === today);
            const line = STATE_LINE[state];
            return (
              <div key={t.id} className="card !py-3 flex items-center gap-3">
                <span className="text-3xl">{t.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{t.label}</div>
                  <div className={`text-xs ${line.tone}`}>{latest?.status === "pending" && latest.rater_verdict ? (latest.rater_verdict === "approved" ? "Your sister says it is done · waiting for Dad" : "Your sister sent it back") : line.text}{t.window_start && t.window_end ? ` · ${t.window_start.slice(0, 5)}–${t.window_end.slice(0, 5)}` : ""}</div>
                  {latest?.status === "pending" && latest.rater_verdict === "rejected" && latest.rater_note && <div className="text-xs text-warn">She said: {latest.rater_note}</div>}
                  {latest?.review_note && <div className="text-xs text-warn">Parent: {latest.review_note}</div>}
                </div>
                {open || state === "rejected" ? (
                  <SnapCapture familyId={family.id} studentId={profile.id} taskId={t.id} label={t.label} done={state === "good" || state === "approved"} compact />
                ) : (
                  <span className="text-xs muted">{state === "closed" ? "closed" : "not yet"}</span>
                )}
              </div>
            );
          })}
        </section>
      )}

      {hwTask && (
        <section className="card space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✍️</span>
            <div className="flex-1">
              <h2 className="h2">Handwriting corner</h2>
              <p className="text-xs muted">{hwDueToday ? "Due today: " : "Any day: "}write 4–6 lines (English or Arabic), photograph them straight on. The coach scores it and gives you one line to practise.</p>
            </div>
          </div>
          {lastHw?.ai_detail && (
            <div className="tile space-y-1 text-sm">
              <div className="flex items-center gap-2"><span className="font-bold text-lg" style={{ fontFamily: "var(--font-display)" }}>{lastHw.ai_detail.score}/100</span><span className="muted text-xs">last sample · {prettyDate(lastHw.taken_on)}{hwSamples.length > 1 ? ` · before: ${hwSamples[hwSamples.length - 2].ai_detail?.score ?? handwritingScore(hwSamples[hwSamples.length - 2].ai_detail as HandwritingAnalysis)}` : ""}</span></div>
              {(lastHw.ai_detail.strengths?.length ?? 0) > 0 && <div>👍 {lastHw.ai_detail.strengths!.join(" · ")}</div>}
              {(lastHw.ai_detail.focus?.length ?? 0) > 0 && <div>🎯 Work on: {lastHw.ai_detail.focus!.join(" · ")}</div>}
              {lastHw.ai_detail.practice_line && <div>Copy five times, then snap again:<br /><b className="text-lg" style={{ fontFamily: "var(--font-arabic), var(--font-display)" }} dir="auto">{lastHw.ai_detail.practice_line}</b></div>}
              {hwUrls.get(lastHw.id) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hwUrls.get(lastHw.id)} alt="" className="rounded-xl max-h-40 object-cover w-full mt-1" />
              )}
            </div>
          )}
          <SnapCapture familyId={family.id} studentId={profile.id} taskId={hwTask.id} label="handwriting" done={!!lastHw && lastHw.taken_on === today} />
        </section>
      )}

      <p className="text-xs muted">Rules: no people in the pictures. Pictures stay inside the family and are deleted after 30 days (handwriting samples are kept to show progress).</p>
    </main>
  );
}
