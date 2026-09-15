import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, prettyDate } from "@/lib/dates";
import { computeStreak } from "@/lib/points";
import { decideRedemptionAction } from "@/lib/actions/rewards";
import { loadPlan } from "@/lib/plan/prepare";
import { acknowledgeAlertAction } from "@/lib/actions/wellbeing";
import { KIND_EMOJI, type Assignment, type Checkin, type CheckinItem, type Profile, type Redemption } from "@/lib/types";

const MOOD = ["", "😞", "😕", "😐", "🙂", "😄"];

export default async function ParentHome() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const weekAhead = shiftDate(today, 7);

  const { data: kids } = await supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false });
  const students = (kids ?? []) as Profile[];
  if (students.length === 0) {
    return (
      <main className="space-y-4">
        <h1 className="h1">Welcome 👋</h1>
        <div className="card space-y-3">
          <p>Start by adding your kids. Each gets a username and password to log in from their phone or the laptop.</p>
          <Link href="/parent/children" className="btn-primary">Add a child</Link>
        </div>
      </main>
    );
  }
  const ids = students.map((s) => s.id);
  const [{ data: checkins }, { data: open }, { data: ledger }, { data: pending }, { data: report }, { data: prayers }, { data: alerts }] = await Promise.all([
    supabase.from("checkins").select("*, checkin_items(*, assignments(title, kind))").in("student_id", ids).gte("checkin_date", shiftDate(today, -30)),
    supabase.from("assignments").select("*").in("student_id", ids).eq("status", "open"),
    supabase.from("points_ledger").select("student_id, delta").in("student_id", ids),
    supabase.from("redemptions").select("*, rewards(title, emoji, kind, cash_amount_egp), profiles(full_name)").in("student_id", ids).eq("status", "pending"),
    supabase.from("daily_reports").select("*").eq("family_id", family.id).order("report_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("prayer_logs").select("student_id, prayer, status").in("student_id", ids).eq("log_date", today),
    supabase.from("safety_alerts").select("*, profiles(full_name)").eq("family_id", family.id).is("acknowledged_at", null).order("created_at", { ascending: false }),
  ]);
  const openAlerts = (alerts ?? []) as { id: string; level: "amber" | "red"; category: string; summary: string; created_at: string; profiles: { full_name: string } | null }[];
  const plans = await Promise.all(students.map((s) => loadPlan(s.id).catch(() => null)));
  const planReady = plans.reduce((n, p) => n + (p ? p.quizzes.filter((q) => q.scheduled_for >= p.today).length : 0), 0);
  const planWanted = plans.reduce((n, p) => n + (p ? p.wanted.length : 0), 0);
  const planMissing = plans.reduce((n, p) => n + (p ? p.missing.length : 0), 0);
  type CK = Checkin & { checkin_items: (CheckinItem & { assignments: { title: string; kind: Assignment["kind"] } | null })[] };
  const allCk = (checkins ?? []) as CK[];
  const openAll = (open ?? []) as Assignment[];
  const pendingList = (pending ?? []) as (Redemption & { rewards: { title: string; emoji: string; kind: string; cash_amount_egp: number | null } | null; profiles: { full_name: string } | null })[];

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">{prettyDate(today)}</h1>
        <div className="flex gap-2">
          <Link href="/parent/guide" className="btn-ghost btn-sm">❓ Guide</Link>
          <Link href="/parent/plan" className="btn-ghost btn-sm">📅 Quiz plan</Link>
          <Link href="/parent/reports" className="btn-ghost btn-sm">Reports</Link>
        </div>
      </div>

      {openAlerts.map((a) => (
        <section key={a.id} className={`card space-y-2 ${a.level === "red" ? "border-bad" : "border-warn"}`}>
          <div className="flex items-start gap-3">
            <span className="text-3xl">{a.level === "red" ? "🚨" : "💛"}</span>
            <div className="flex-1 text-sm">
              <div className="font-bold">{a.level === "red" ? "Please talk to" : "A gentle heads-up about"} {a.profiles?.full_name?.split(" ")[0]}</div>
              <div className="muted">{a.summary}. {a.level === "red" ? "Sit with him calmly today and listen first. If you think he is in immediate danger call 123." : "A relaxed conversation this week, without grades, would help."} What he wrote stays private; the app only tells you that you are needed.</div>
              <div className="text-[11px] muted mt-1">{String(a.created_at).slice(0, 16).replace("T", " ")}</div>
            </div>
          </div>
          <form action={acknowledgeAlertAction.bind(null, a.id)} className="flex justify-end"><button className="btn-ghost btn-sm">I have talked to him</button></form>
        </section>
      ))}

      <Link href="/parent/plan" className={`card flex items-center gap-3 ${planMissing > 0 ? "border-warn/60" : "border-good/40"}`}>
        <span className="text-3xl">📅</span>
        <div className="flex-1">
          <div className="font-bold">Weekly quiz plan</div>
          <div className="text-xs muted">
            {planWanted === 0 ? "No school days found in the timetables yet." : `${planReady} of ${planWanted} quizzes ready for the next 7 days.`}
            {planMissing > 0 ? ` ${planMissing} still to prepare.` : planWanted > 0 ? " All set." : ""}
          </div>
        </div>
        <span className={planMissing > 0 ? "btn-primary btn-sm" : "btn-ghost btn-sm"}>{planMissing > 0 ? "Prepare" : "Open"}</span>
      </Link>

      {students.map((s) => {
        const mine = allCk.filter((c) => c.student_id === s.id);
        const ck = mine.find((c) => c.checkin_date === today);
        const streak = computeStreak(mine.map((c) => c.checkin_date), today) || computeStreak(mine.map((c) => c.checkin_date), shiftDate(today, -1));
        const balance = (ledger ?? []).filter((l) => l.student_id === s.id).reduce((a, l) => a + l.delta, 0);
        const overdue = openAll.filter((a) => a.student_id === s.id && a.due_date && a.due_date < today && (a.kind === "homework" || a.kind === "project"));
        const tests = openAll.filter((a) => a.student_id === s.id && (a.kind === "quiz" || a.kind === "exam") && a.due_date && a.due_date >= today && a.due_date <= weekAhead);
        const last7 = Array.from({ length: 7 }, (_, i) => shiftDate(today, -6 + i));
        return (
          <section key={s.id} className="card space-y-3">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{s.avatar_emoji}</div>
              <div className="flex-1">
                <div className="font-bold">{s.full_name} <span className="muted font-normal text-sm">· Grade {s.grade}</span></div>
                <div className="text-xs muted">{balance} ⭐ · {streak}🔥 streak</div>
              </div>
              <div className={`badge ${ck ? "text-good" : "text-bad"}`}>{ck ? "checked in" : "no check-in yet"}</div>
            </div>

            <div className="flex gap-1">
              {last7.map((d) => {
                const has = mine.some((c) => c.checkin_date === d);
                return <div key={d} title={d} className={`h-2 flex-1 rounded ${has ? "bg-good" : d === today ? "bg-panel-2 border border-line" : "bg-bad/40"}`} />;
              })}
            </div>

            {ck && (
              <div className="text-sm space-y-1">
                <div>{ck.mood ? MOOD[ck.mood] : ""} {ck.minutes_studied} min studied · {ck.checkin_items.filter((i) => i.status === "done").length}/{ck.checkin_items.length} tasks done</div>
                {ck.checkin_items.map((i) => (
                  <div key={i.id} className="text-xs muted">
                    {i.status === "done" ? "✅" : i.status === "partial" ? "🟡" : "❌"} {i.assignments ? `${KIND_EMOJI[i.assignments.kind]} ${i.assignments.title}` : "task"}
                  </div>
                ))}
                {ck.learned && <div className="text-xs"><span className="muted">Learned:</span> {ck.learned}</div>}
                {ck.stuck_on && <div className="text-xs text-warn"><span className="muted">Stuck on:</span> {ck.stuck_on}</div>}
              </div>
            )}

            <div className="text-xs muted">
              🕌 {["fajr", "dhuhr", "asr", "maghrib", "isha"].map((p) => {
                const log = (prayers ?? []).find((x) => x.student_id === s.id && x.prayer === p);
                return <span key={p} className="mr-2">{log ? (log.status === "on_time" ? "✅" : "🟡") : "⬜"} {p[0].toUpperCase() + p.slice(1)}</span>;
              })}
            </div>
            {overdue.length > 0 && (
              <div className="text-xs text-bad">⏰ Overdue: {overdue.map((o) => o.title).join(", ")}</div>
            )}
            {tests.length > 0 && (
              <div className="text-xs text-warn">🎯 {tests.map((t) => `${t.title} (${prettyDate(t.due_date!)})`).join(", ")}</div>
            )}
          </section>
        );
      })}

      {pendingList.length > 0 && (
        <section className="card space-y-2">
          <h2 className="h2">🎁 Reward requests</h2>
          {pendingList.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm">
              <div className="flex-1">
                <b>{r.profiles?.full_name}</b> wants {r.rewards?.emoji} {r.rewards?.title}
                {r.rewards?.kind === "cash" && r.rewards.cash_amount_egp ? ` (${Number(r.rewards.cash_amount_egp)} EGP)` : ""} · {r.points_spent} pts
              </div>
              <form action={decideRedemptionAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approved" /><button className="btn-primary btn-sm">Approve</button></form>
              <form action={decideRedemptionAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="rejected" /><button className="btn-ghost btn-sm">No</button></form>
            </div>
          ))}
        </section>
      )}

      {report && (
        <section className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="h2">Last report · {prettyDate(report.report_date)}</h2>
            <span className={`badge ${report.status === "sent" ? "text-good" : report.status === "failed" ? "text-bad" : "text-warn"}`}>{report.status}</span>
          </div>
          <pre className="whitespace-pre-wrap text-xs muted font-sans">{report.body}</pre>
        </section>
      )}
    </main>
  );
}
