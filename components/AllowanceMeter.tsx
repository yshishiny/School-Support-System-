import { BANDS, bandFor, eligibilityHint } from "@/lib/allowance";
import type { WeekStatus } from "@/lib/allowance/week";
import { prettyDate } from "@/lib/dates";

/** What the child sees all week: the meter, the band it is heading for, and each basic's state. */
export function AllowanceMeter({ status, compact = false }: { status: WeekStatus; compact?: boolean }) {
  // The band the week will actually pay, which is not always the one the score reaches: a week with no photo
  // proof in it pays nothing whatever it scored, and a label reading "Some of it" above a 0 would be a lie.
  const b = BANDS.find((x) => x.band === status.band) ?? bandFor(status.score);
  const next = status.blocked ? null : BANDS.filter((x) => x.min > status.score).sort((x, y) => x.min - y.min)[0];
  const color = status.band === "full" ? "bg-good" : status.band === "most" ? "bg-accent" : status.band === "some" ? "bg-warn" : "bg-bad";
  return (
    <section className="card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="h2">💵 Weekly allowance</h2>
        <span className="badge">{prettyDate(status.start)} → {prettyDate(status.end)}</span>
      </div>
      <div className="flex items-end gap-3">
        <div className="text-4xl font-extrabold text-accent-2" style={{ fontFamily: "var(--font-display)" }}>{status.amount} <span className="text-base muted font-semibold">EGP</span></div>
        <div className="text-sm muted pb-1">{b.label} · score {status.score}/100 · day {status.elapsedDays} of 7</div>
      </div>
      {/*
        Where the score came from. Untouched columns pay in full on purpose — a week with no homework
        set should not be punished for it — but that generosity is invisible in a single number, and a
        parent looking at "37" cannot tell an average week from one where nobody opened the app.
      */}
      {status.blocked && (
        <div className="rounded-xl border border-bad/60 bg-bad/10 p-2.5 text-sm">
          <div className="font-semibold">📸 No pay without a photo</div>
          <div className="text-xs mt-0.5">
            {status.blocked}. The score stays {status.score}, but a week with no picture in it does not pay.
            {status.blockedForGood ? " Nothing is due before pay day now, so this week ends at 0." : " One snap on one day lifts it."}
          </div>
        </div>
      )}
      <div className="text-xs muted">
        <b className={status.measuredScore > 0 ? "text-good" : "text-bad"}>{status.measuredScore} earned</b>
        {" "}from what he actually did · <b>{status.defaultScore} given</b> because nothing was set, ticked or due
        {status.measuredScore === 0 && status.score > 0 && <span className="text-bad"> — nothing this week was earned.</span>}
      </div>
      <div className="h-3 rounded-full bg-panel-2 overflow-hidden relative">
        <div className={`h-full ${color} transition-all`} style={{ width: `${status.score}%` }} />
        {BANDS.filter((x) => x.min > 0).map((x) => (
          <span key={x.band} className="absolute top-0 h-full w-0.5 bg-ink/40" style={{ left: `${x.min}%` }} title={`${x.label} from ${x.min}`} />
        ))}
      </div>
      {(() => {
        const h = eligibilityHint(status, status.allowance);
        const cls = h.tone === "good" ? "border-good/50 bg-good/10" : h.tone === "warn" ? "border-warn/50 bg-warn/10" : "border-bad/50 bg-bad/10";
        return (
          <div className={`rounded-xl border p-2.5 text-sm space-y-1 ${cls}`}>
            <div className="font-semibold">{h.tone === "good" ? "✅" : h.tone === "warn" ? "⚠️" : "⛔"} {h.text}</div>
            {status.hints.length > 0 && (
              <ul className="text-xs space-y-0.5">
                {status.hints.slice(0, compact ? 2 : 4).map((x) => <li key={x}>→ {x}</li>)}
              </ul>
            )}
            {next && <div className="text-xs muted">{next.min - status.score} more points reach “{next.label}” ({Math.round(status.allowance * next.share)} EGP).</div>}
          </div>
        );
      })()}
      <details className="text-xs muted">
        <summary className="cursor-pointer">How eligibility works</summary>
        <div className="mt-1 space-y-0.5">
          <div>Each basic has points. Dish, manners and phone are judged by your parents once a day; only a ✗ costs you. Prayers, check-ins, planned quizzes and the coach check-in are counted by the app.</div>
          <div>Score out of 100 on {status.end ? "pay day" : "the week"}: 90+ pays the full {status.allowance} EGP · 70+ pays {Math.round(status.allowance * 0.7)} · 50+ pays {Math.round(status.allowance * 0.4)} · under 50 pays nothing. Every day counts, and a bad day can be balanced by good ones.</div>
          <div>Two rules sit on top of the score. A basic your parents never tapped either way pays <b>half</b>, not full — silence is not a ✓. And a week with <b>no snap at all</b> pays nothing, whatever it scored: one picture on one day is enough to lift it.</div>
        </div>
      </details>
      {!compact && (
        <ul className="text-sm divide-y divide-line">
          {status.results.map((r) => (
            <li key={r.code} className="py-1.5 flex items-center gap-2">
              <span className="text-lg">{r.emoji}</span>
              <span className="flex-1">{r.label}<span className="muted text-xs"> · {r.detail}</span></span>
              {r.basis === "default" && <span className="badge muted text-[10px]" title="Nothing to measure, so this was given in full">given</span>}
              <span className={`badge ${r.basis === "default" ? "muted" : r.fraction >= 0.99 ? "text-good" : r.fraction >= 0.5 ? "text-warn" : "text-bad"}`}>{r.earned}/{r.weight}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
