import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, prettyDate } from "@/lib/dates";
import { dueSnapTasks, handwritingScore, taskDayState, windowOpen, type DayState, type HandwritingAnalysis, type SnapLite } from "@/lib/snaps";
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
    loadSnapTasks(family.id),
    supabase.from("snaps").select("id, task_code, kind, path, taken_on, status, ai_verdict, ai_note, ai_detail, review_note, created_at").eq("student_id", profile.id).gte("taken_on", shiftDate(today, -60)).order("created_at"),
  ]);
  type Row = SnapLite & { id: string; kind: string; path: string; ai_note: string | null; ai_detail: (Partial<HandwritingAnalysis> & { score?: number }) | null; review_note: string | null; created_at: string };
  const snaps = (snapRows ?? []) as Row[];
  const due = dueSnapTasks(today, tasks, profile.id);
  const dailyTasks = due.filter((t) => t.kind !== "handwriting");
  const hwTask = tasks.find((t) => t.kind === "handwriting" && t.enabled && (t.student_id === null || t.student_id === profile.id)) ?? null;
  const hwSamples = snaps.filter((s) => s.kind === "handwriting" && s.ai_detail?.score !== undefined);
  const lastHw = hwSamples[hwSamples.length - 1] ?? null;
  const hwUrls = await signSnapUrls(hwSamples.slice(-2).map((s) => ({ id: s.id, path: s.path })));
  const hwDueToday = !!hwTask && due.some((t) => t.id === hwTask.id);

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

      {tasks.length === 0 && <p className="card muted text-sm">No snap tasks yet. Ask a parent to switch some on under Allowance.</p>}

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
                  <div className={`text-xs ${line.tone}`}>{line.text}{t.window_start && t.window_end ? ` · ${t.window_start.slice(0, 5)}–${t.window_end.slice(0, 5)}` : ""}</div>
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
