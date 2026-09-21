import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent } from "@/lib/auth";
import { traceFor } from "@/lib/trace/load";
import { markAllowancePaidAction } from "@/lib/actions/allowance";
import { verdict } from "@/lib/trace";
import { mismatchLine, payoutOf } from "@/lib/rewards/money";
import { prettyDate, todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A number with its label under it, used across the top of the page. */
function Figure({ value, unit, label, tone }: { value: string | number; unit?: string; label: string; tone?: "money" | "bad" | "plain" }) {
  const colour = tone === "money" ? "text-accent-2" : tone === "bad" ? "text-bad" : "";
  return (
    <div className="min-w-0">
      <div className={`text-3xl font-bold leading-none ${colour}`} style={{ fontFamily: "var(--font-display)" }}>
        {value}
        {unit && <span className="text-sm font-semibold muted ml-1">{unit}</span>}
      </div>
      <div className="text-[11px] uppercase tracking-wide muted mt-1.5">{label}</div>
    </div>
  );
}

/**
 * One child, the whole width.
 *
 * Written as a statement of account rather than a dashboard: what he is owed, what is still unsettled, what he
 * did each day of the week, and the entries every figure above comes from. The emoji that label columns
 * elsewhere are spelled out here, because there is finally room for words.
 */
export default async function ChildTracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { family } = await requireParent();
  const t = await traceFor(family, id);
  if (!t) notFound();
  const today = todayIn(family.timezone);
  const st = t.status;

  return (
    <main className="space-y-5 max-w-4xl">
      {/* One way back, and no second menu. */}
      <div className="flex items-center gap-3">
        <Link href="/parent/trace" className="btn-ghost btn-sm shrink-0">← All children</Link>
        <span className="muted text-xs truncate">Money and proof</span>
      </div>

      <header className="flex items-center gap-4">
        <span className="h-16 w-16 shrink-0 rounded-full overflow-hidden border border-line bg-panel-2 grid place-items-center text-3xl">
          {t.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.avatar} alt="" className="h-full w-full object-cover" />
          ) : t.emoji}
        </span>
        <div className="min-w-0">
          <h1 className="h1 leading-tight">{t.fullName}</h1>
          <p className="muted text-sm">
            {t.grade !== null && <>Grade {t.grade} · </>}week of {prettyDate(st.start)} → {prettyDate(st.end)}
          </p>
        </div>
      </header>

      {/* ── The account ───────────────────────────────────────────────────── */}
      <section className="card space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Figure value={t.owed.handOver} unit="EGP" label="Hand over now" tone="money" />
          <Figure value={t.owed.unpaidTotal} unit="EGP" label="Unsettled weeks" tone={t.owed.unpaidTotal > 0 ? "money" : "plain"} />
          <Figure value={t.points} label="Points held" />
          <Figure value={`${st.score}/100`} label="This week's score" tone={st.blocked ? "bad" : "plain"} />
        </div>
        <p className="text-sm border-t border-line pt-3">{verdict(t.owed, t.name)}</p>
        <p className="text-xs muted">
          Points are not money: they buy what is in the Rewards catalog at its listed price. Only a paid allowance
          week or a cash reward becomes EGP.
        </p>
      </section>

      {st.blocked && (
        <section className="card border-bad/60 space-y-1">
          <h2 className="h2">This week pays nothing</h2>
          <p className="text-sm">
            {st.blocked}. The score stands at {st.score} — the gate does not change it, only whether it pays.
            {st.blockedForGood ? " Nothing is due before pay day now, so the week is settled at 0." : " One snap on one day lifts it."}
          </p>
        </section>
      )}

      {t.owed.unpaidWeeks.length > 0 && (
        <section className="card space-y-2">
          <h2 className="h2">Weeks you have not settled</h2>
          <ul className="text-sm divide-y divide-line">
            {t.owed.unpaidWeeks.map((w) => (
              <li key={w.id} className="py-2.5 flex items-center gap-3">
                <span className="flex-1 min-w-0">
                  <span className="block">{prettyDate(w.week_start)} → {prettyDate(w.week_end)}</span>
                  <span className="block text-xs muted">Scored {w.score} · {w.band}{w.claimed_at ? " · he has asked for it" : ""}</span>
                </span>
                <b className="shrink-0 text-accent-2">{w.amount} EGP</b>
                <form action={markAllowancePaidAction.bind(null, w.id)} className="shrink-0">
                  <button className="btn-primary btn-sm">Mark paid</button>
                </form>
              </li>
            ))}
          </ul>
          <p className="text-xs muted">Marking a week paid records the earning and the hand-over together, so what you hold drops by exactly that amount.</p>
        </section>
      )}

      {t.requestList.length > 0 && (
        <section className="card space-y-2">
          <h2 className="h2">Reward requests waiting</h2>
          <ul className="text-sm divide-y divide-line">
            {t.requestList.map((r) => {
              const pays = payoutOf({ cash_amount_egp: r.cash });
              const lie = mismatchLine(r.title, r.cash);
              return (
                <li key={r.id} className="py-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="flex-1 min-w-0">{r.emoji} <b>{r.title}</b></span>
                    <span className="shrink-0 muted text-xs">{r.pointsSpent} points</span>
                    {pays > 0 && <b className="shrink-0 text-accent-2">pays {pays} EGP</b>}
                  </div>
                  <div className="text-xs muted mt-0.5">Asked {prettyDate(r.requestedAt.slice(0, 10))}</div>
                  {lie && <div className="text-xs text-bad mt-0.5">{lie} Approving pays {pays} EGP.</div>}
                </li>
              );
            })}
          </ul>
          <Link href="/parent/rewards?tab=requests" className="btn-ghost btn-sm">Approve or reject →</Link>
        </section>
      )}

      {/* ── The evidence ──────────────────────────────────────────────────── */}
      <section className="card space-y-3">
        <div>
          <h2 className="h2">What {t.name} did, day by day</h2>
          <p className="text-xs muted mt-0.5">The rows the score was built from. A line of dashes is the answer to “is this real?”.</p>
        </div>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="text-sm w-full">
            <thead>
              <tr className="text-left muted text-xs">
                <th className="py-1.5 pr-3 font-semibold">Day</th>
                <th className="py-1.5 px-2 font-semibold">Check-in</th>
                <th className="py-1.5 px-2 font-semibold">Prayers</th>
                <th className="py-1.5 px-2 font-semibold">Classes</th>
                <th className="py-1.5 px-2 font-semibold">Quizzes</th>
                <th className="py-1.5 px-2 font-semibold">Snaps</th>
                <th className="py-1.5 pl-2 font-semibold text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {t.days.map((d) => {
                const future = d.date > today;
                const nothing = !future && !d.checkedIn && d.prayers + d.classesLogged + d.quizzesDone + d.snaps === 0;
                const cell = (n: number) => (future ? <span className="muted">·</span> : n > 0 ? n : <span className="muted">—</span>);
                return (
                  <tr key={d.date} className={`border-t border-line ${future ? "opacity-40" : ""}`}>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className={nothing ? "text-bad" : ""}>{DAY_NAMES[new Date(d.date + "T00:00:00Z").getUTCDay()].slice(0, 3)}</span>
                      <span className="muted text-xs ml-1">{d.date.slice(8)}</span>
                    </td>
                    <td className="py-2 px-2">{future ? <span className="muted">·</span> : d.checkedIn ? <span className="text-good">yes</span> : <span className="muted">—</span>}</td>
                    <td className="py-2 px-2">{cell(d.prayers)}</td>
                    <td className="py-2 px-2">{cell(d.classesLogged)}</td>
                    <td className="py-2 px-2">{cell(d.quizzesDone)}</td>
                    <td className="py-2 px-2">{cell(d.snaps)}</td>
                    <td className="py-2 pl-2 text-right">{cell(d.pointsEarned)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-xs border-t border-line pt-2.5">
          Score {st.score}/100 → <b>{st.amount} EGP</b> ·{" "}
          <b className={st.measuredScore > 0 ? "text-good" : "text-bad"}>{st.measuredScore} earned</b> from what he did,{" "}
          <b>{st.defaultScore} given</b> for what had nothing to measure.
        </div>
        {t.weekEmpty && (
          <p className="text-xs text-bad">
            Nothing at all is recorded for {t.name} this week, yet the score is {st.score}. That is the app being
            generous with untouched columns, not evidence that he did anything.
          </p>
        )}
      </section>

      {/* ── Each basic ────────────────────────────────────────────────────── */}
      <section className="card space-y-2">
        <h2 className="h2">Every basic, and what it paid</h2>
        <ul className="text-sm divide-y divide-line">
          {st.results.map((r) => (
            <li key={r.code} className="py-2 flex items-center gap-3">
              <span className="text-lg shrink-0">{r.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate">{r.label}</span>
                <span className="block text-xs muted">{r.detail}</span>
              </span>
              {r.basis === "default" && <span className="badge muted text-[10px] shrink-0">given</span>}
              <span className={`shrink-0 tabular-nums text-sm ${r.basis === "default" ? "muted" : r.fraction >= 0.99 ? "text-good" : r.fraction >= 0.5 ? "text-warn" : "text-bad"}`}>
                {r.earned}/{r.weight}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── The ledger ────────────────────────────────────────────────────── */}
      <section className="card space-y-2">
        <div>
          <h2 className="h2">Every entry</h2>
          <p className="text-xs muted mt-0.5">Each figure on this page comes from one of these lines.</p>
        </div>
        {t.lines.length === 0 ? <p className="text-sm muted">Nothing recorded yet.</p> : (
          <ul className="text-sm divide-y divide-line max-h-[32rem] overflow-y-auto">
            {t.lines.map((l, k) => (
              <li key={`${l.on}-${k}`} className="py-2 flex items-baseline gap-3">
                <span className="muted text-xs whitespace-nowrap w-24 shrink-0 tabular-nums">{l.on.slice(5)}{l.at ? ` ${l.at}` : ""}</span>
                <span className="flex-1 min-w-0">{l.what}</span>
                {l.points !== null && <b className={`shrink-0 tabular-nums ${l.points >= 0 ? "text-good" : "text-bad"}`}>{l.points > 0 ? "+" : ""}{l.points}</b>}
                {l.egp !== null && <b className={`shrink-0 tabular-nums ${l.egp >= 0 ? "text-accent-2" : "muted"}`}>{l.egp > 0 ? "+" : ""}{l.egp} EGP</b>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
