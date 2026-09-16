import { BANDS, bandFor } from "@/lib/allowance";
import type { WeekStatus } from "@/lib/allowance/week";
import { prettyDate } from "@/lib/dates";

/** What the child sees all week: the meter, the band it is heading for, and each basic's state. */
export function AllowanceMeter({ status, compact = false }: { status: WeekStatus; compact?: boolean }) {
  const b = bandFor(status.score);
  const next = BANDS.filter((x) => x.min > status.score).sort((x, y) => x.min - y.min)[0];
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
      <div className="h-3 rounded-full bg-panel-2 overflow-hidden relative">
        <div className={`h-full ${color} transition-all`} style={{ width: `${status.score}%` }} />
        {BANDS.filter((x) => x.min > 0).map((x) => (
          <span key={x.band} className="absolute top-0 h-full w-0.5 bg-ink/40" style={{ left: `${x.min}%` }} title={`${x.label} from ${x.min}`} />
        ))}
      </div>
      {next && <p className="text-xs muted">{next.min - status.score} more points this week reach “{next.label}” ({Math.round(status.allowance * next.share)} EGP).</p>}
      {!compact && (
        <ul className="text-sm divide-y divide-line">
          {status.results.map((r) => (
            <li key={r.code} className="py-1.5 flex items-center gap-2">
              <span className="text-lg">{r.emoji}</span>
              <span className="flex-1">{r.label}<span className="muted text-xs"> · {r.detail}</span></span>
              <span className={`badge ${r.fraction >= 0.99 ? "text-good" : r.fraction >= 0.5 ? "text-warn" : "text-bad"}`}>{r.earned}/{r.weight}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
