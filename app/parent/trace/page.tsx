import Link from "next/link";
import { SideTabs } from "@/components/SideTabs";
import { kidColor } from "@/lib/kid-tabs";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowanceWeekStatus } from "@/lib/allowance/week";
import { markAllowancePaidAction } from "@/lib/actions/allowance";
import { loadWallet } from "@/lib/wallet/ledger";
import { balances } from "@/lib/wallet";
import { owed, timeline, verdict, weekIsEmpty, type ClosedWeek, type DayEvidence, type PointEntry } from "@/lib/trace";
import { mismatchLine, payoutOf } from "@/lib/rewards/money";
import { prettyDate, shiftDate, todayIn } from "@/lib/dates";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TracePage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const admin = createAdminClient();
  const today = todayIn(family.timezone);

  const { data: kids } = await supabase
    .from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false });
  const students = (kids ?? []) as Profile[];
  if (students.length === 0) {
    return <main className="space-y-4"><h1 className="h1">Money and proof</h1><p className="card text-sm muted">No children yet.</p></main>;
  }
  const ids = students.map((s) => s.id);

  const statuses = await Promise.all(students.map((s) => allowanceWeekStatus(s.id, family)));
  // The fourteen days behind the current week's start, so a parent can see the week before this one too.
  const from = shiftDate(statuses[0]?.start ?? today, -7);

  const [wallets, { data: weekRows }, { data: pointRows }, { data: ckRows }, { data: prayerRows }, { data: logRows }, { data: quizRows }, { data: snapRows }, { data: redRows }] =
    await Promise.all([
      Promise.all(students.map((s) => loadWallet(s.id))),
      supabase.from("allowance_weeks").select("id, student_id, week_start, week_end, score, band, amount, paid_at, claimed_at").eq("family_id", family.id).order("week_start", { ascending: false }),
      admin.from("points_ledger").select("student_id, delta, reason, created_at, ref_type").in("student_id", ids).order("created_at", { ascending: false }).limit(400),
      admin.from("checkins").select("student_id, checkin_date").in("student_id", ids).gte("checkin_date", from),
      admin.from("prayer_logs").select("student_id, log_date").in("student_id", ids).gte("log_date", from),
      admin.from("lesson_logs").select("student_id, log_date").in("student_id", ids).gte("log_date", from),
      admin.from("quizzes").select("student_id, scheduled_for, attempts(submitted_at)").in("student_id", ids).gte("scheduled_for", from),
      admin.from("snaps").select("student_id, taken_on, status").in("student_id", ids).gte("taken_on", from),
      supabase.from("redemptions").select("id, student_id, points_spent, status, requested_at, rewards(title, emoji, cash_amount_egp)").in("student_id", ids).eq("status", "pending"),
    ]);

  type Row = { student_id: string };
  const mine = <T extends Row>(rows: T[] | null, id: string) => (rows ?? []).filter((r) => r.student_id === id);
  const allWeeks = (weekRows ?? []) as (ClosedWeek & { student_id: string })[];
  const pending = (redRows ?? []) as unknown as { id: string; student_id: string; points_spent: number; status: string; requested_at: string; rewards: { title: string; emoji: string; cash_amount_egp: string | number | null } | null }[];

  const tabs = students.map((s, i) => {
    const first = s.full_name.split(" ")[0];
    const st = statuses[i];
    const wallet = wallets[i];
    const b = balances(wallet);
    const weeks = allWeeks.filter((w) => w.student_id === s.id);
    const o = owed(b.withDad, weeks);
    const points = mine(pointRows as (PointEntry & Row)[] | null, s.id) as PointEntry[];
    const pointsTotal = points.reduce((n, p) => n + p.delta, 0);
    const lines = timeline(points, wallet);
    const mineRed = pending.filter((r) => r.student_id === s.id);

    // The current week, day by day, from the same rows the score was built on.
    const ck = new Set(mine(ckRows as ({ checkin_date: string } & Row)[] | null, s.id).map((r) => r.checkin_date));
    const prayerBy = mine(prayerRows as ({ log_date: string } & Row)[] | null, s.id);
    const logBy = mine(logRows as ({ log_date: string } & Row)[] | null, s.id);
    const quizBy = mine(quizRows as ({ scheduled_for: string; attempts: { submitted_at: string | null }[] } & Row)[] | null, s.id);
    const snapBy = mine(snapRows as ({ taken_on: string; status: string } & Row)[] | null, s.id);
    const days: DayEvidence[] = Array.from({ length: 7 }, (_, k) => {
      const d = shiftDate(st.start, k);
      return {
        date: d,
        checkedIn: ck.has(d),
        prayers: prayerBy.filter((r) => r.log_date === d).length,
        classesLogged: logBy.filter((r) => r.log_date === d).length,
        quizzesDone: quizBy.filter((r) => r.scheduled_for === d && r.attempts.some((a) => a.submitted_at)).length,
        snaps: snapBy.filter((r) => r.taken_on === d && r.status !== "rejected").length,
        pointsEarned: points.filter((p) => p.created_at.slice(0, 10) === d && p.delta > 0).reduce((n, p) => n + p.delta, 0),
      };
    });
    const elapsed = days.filter((d) => d.date <= today);
    const empty = weekIsEmpty(elapsed);

    const content = (
      <div className="space-y-3">
        {/* One sentence, before anything else on the page. */}
        <section className="card space-y-2">
          <div className="text-[10px] uppercase tracking-wide muted">Hand over now</div>
          <div className="flex items-end gap-3">
            <div className="text-4xl font-extrabold text-accent-2" style={{ fontFamily: "var(--font-display)" }}>
              {o.handOver} <span className="text-base muted font-semibold">EGP</span>
            </div>
            {o.unpaidTotal > 0 && <div className="text-sm muted pb-1">+{o.unpaidTotal} EGP once you mark {o.unpaidWeeks.length === 1 ? "the week" : "the weeks"} below paid</div>}
          </div>
          <p className="text-sm">{verdict(o, first)}</p>
          <p className="text-xs muted">
            Points are not money. {first} holds <b>{pointsTotal} ⭐</b>, which only buys what is in the Rewards catalog at its listed price. Nothing converts stars into EGP by itself.
          </p>
        </section>

        {o.unpaidWeeks.length > 0 && (
          <section className="card space-y-2">
            <h2 className="h2">Weeks you have not settled</h2>
            <ul className="text-sm divide-y divide-line">
              {o.unpaidWeeks.map((w) => (
                <li key={w.id} className="py-2 flex items-center gap-2">
                  <span className="flex-1">
                    {prettyDate(w.week_start)} → {prettyDate(w.week_end)} · score {w.score} · <b>{w.amount} EGP</b>
                    {w.claimed_at && <span className="badge text-warn ml-1">he asked for it</span>}
                  </span>
                  <form action={markAllowancePaidAction.bind(null, w.id)}>
                    <button className="btn-primary btn-sm">Mark paid</button>
                  </form>
                </li>
              ))}
            </ul>
            <p className="text-xs muted">Marking a week paid records the earning and the hand-over together, so what you are holding drops by exactly that amount.</p>
          </section>
        )}

        {mineRed.length > 0 && (
          <section className="card space-y-2">
            <h2 className="h2">Reward requests waiting</h2>
            <ul className="text-sm divide-y divide-line">
              {mineRed.map((r) => {
                const pays = payoutOf(r.rewards ?? {});
                const lie = r.rewards ? mismatchLine(r.rewards.title, r.rewards.cash_amount_egp) : null;
                return (
                  <li key={r.id} className="py-2">
                    <div>{r.rewards?.emoji} <b>{r.rewards?.title}</b> · costs {r.points_spent} ⭐{pays > 0 ? <> · <b className="text-accent-2">pays {pays} EGP</b></> : " · not cash"}</div>
                    <div className="text-xs muted">asked {prettyDate(r.requested_at.slice(0, 10))}</div>
                    {lie && <div className="text-xs text-bad">⚠️ {lie}</div>}
                  </li>
                );
              })}
            </ul>
            <Link href="/parent/rewards?tab=requests" className="btn-ghost btn-sm">Approve or reject →</Link>
          </section>
        )}

        <section className="card space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="h2">What {first} actually did</h2>
            <span className="badge">{prettyDate(st.start)} → {prettyDate(st.end)}</span>
          </div>
          {/* The evidence behind the score, not the score. A row of dashes is the answer to "is this real?". */}
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead className="muted">
                <tr className="text-left">
                  <th className="py-1 pr-2 font-semibold">Day</th>
                  <th className="py-1 px-1 font-semibold" title="Evening check-in">✅</th>
                  <th className="py-1 px-1 font-semibold" title="Prayers logged">🕌</th>
                  <th className="py-1 px-1 font-semibold" title="Classes written up">📖</th>
                  <th className="py-1 px-1 font-semibold" title="Quizzes submitted">🧠</th>
                  <th className="py-1 px-1 font-semibold" title="Photo proofs">📸</th>
                  <th className="py-1 pl-1 font-semibold text-right">⭐</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const future = d.date > today;
                  const nothing = !future && !d.checkedIn && d.prayers + d.classesLogged + d.quizzesDone + d.snaps === 0;
                  return (
                    <tr key={d.date} className={`border-t border-line ${future ? "opacity-40" : nothing ? "text-bad" : ""}`}>
                      <td className="py-1 pr-2 whitespace-nowrap">{DAY_NAMES[new Date(d.date + "T00:00:00Z").getUTCDay()]} {d.date.slice(8)}</td>
                      <td className="py-1 px-1">{future ? "·" : d.checkedIn ? "✓" : "—"}</td>
                      <td className="py-1 px-1">{future ? "·" : d.prayers || "—"}</td>
                      <td className="py-1 px-1">{future ? "·" : d.classesLogged || "—"}</td>
                      <td className="py-1 px-1">{future ? "·" : d.quizzesDone || "—"}</td>
                      <td className="py-1 px-1">{future ? "·" : d.snaps || "—"}</td>
                      <td className="py-1 pl-1 text-right">{future ? "·" : d.pointsEarned || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-xs">
            Score {st.score}/100 → <b>{st.amount} EGP</b> ·{" "}
            <b className={st.measuredScore > 0 ? "text-good" : "text-bad"}>{st.measuredScore} earned</b>, <b>{st.defaultScore} given</b> for what had nothing to measure.
          </div>
          {st.blocked && (
            <p className="text-xs text-bad">
              📸 <b>Pays nothing this week:</b> {st.blocked}. The score stands at {st.score}, but no photo proof means no
              money — {st.blockedForGood ? "and nothing is due before pay day, so this week is settled at 0." : "one snap on one day lifts it."}
            </p>
          )}
          {empty && (
            <p className="text-xs text-bad">
              Nothing at all is recorded for {first} this week, yet the score is {st.score}. That is the app being generous with
              untouched columns, not evidence that he did anything. Treat {st.amount} EGP as unearned until something appears above.
            </p>
          )}
        </section>

        <section className="card space-y-2">
          <h2 className="h2">Every entry</h2>
          <p className="text-xs muted">Each figure on this page comes from one of these lines. ⭐ are points; EGP is money into or out of what you hold for him.</p>
          {lines.length === 0 ? <p className="text-sm muted">Nothing recorded yet.</p> : (
            <ul className="text-xs divide-y divide-line max-h-96 overflow-y-auto">
              {lines.map((l, k) => (
                <li key={`${l.on}-${k}`} className="py-1.5 flex items-baseline gap-2">
                  <span className="muted whitespace-nowrap w-24 shrink-0">{l.on.slice(5)}{l.at ? ` ${l.at}` : ""}</span>
                  <span className="flex-1 min-w-0">{l.what}</span>
                  {l.points !== null && <b className={l.points >= 0 ? "text-good shrink-0" : "text-bad shrink-0"}>{l.points > 0 ? "+" : ""}{l.points} ⭐</b>}
                  {l.egp !== null && <b className={l.egp >= 0 ? "text-accent-2 shrink-0" : "muted shrink-0"}>{l.egp > 0 ? "+" : ""}{l.egp} EGP</b>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );

    return {
      id: s.id,
      label: first,
      emoji: s.avatar_emoji,
      color: kidColor(i),
      sub: o.ifSettled > 0 ? `${o.ifSettled} EGP` : "nothing owed",
      content,
    };
  });

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="h1">Money and proof</h1>
        <Link href="/parent" className="btn-ghost btn-sm">← Home</Link>
      </div>
      <p className="muted text-sm">
        What each child is owed, and what he did to earn it, on one page. Points buy rewards; only an allowance week or a
        cash reward becomes money.
      </p>
      <SideTabs storageKey="trace" tabs={tabs} />
    </main>
  );
}
