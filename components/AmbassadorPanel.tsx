import { TIERS, egpFor, type Tier } from "@/lib/access";
import { prettyDate } from "@/lib/dates";

export interface AmbassadorView {
  tier: { id: Tier; label: string; from: number; rate: number; blurb: string };
  payingReferred: number;
  commissionEarned: number;
  referred: { familyId: string; name: string; joinedOn: string; payments: number; creditsSpent: number; live: boolean; bonusPaid: boolean }[];
}

/**
 * What an ambassador is owed and why. Everything here is computed from purchases that actually happened, so the
 * page can be read out to somebody asking where their money is: who they brought, who stayed, what was paid.
 */
export function AmbassadorPanel({ view }: { view: AmbassadorView }) {
  const { tier, payingReferred, commissionEarned, referred } = view;
  const next = TIERS.find((t) => t.from > payingReferred);
  const stayed = referred.filter((r) => r.payments > 0);
  const lifetime = stayed.reduce((n, r) => n + r.creditsSpent, 0);

  return (
    <section className="card space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="h2">You are a {tier.label}</h2>
        <span className="badge">{tier.rate > 0 ? `${Math.round(tier.rate * 100)}% of what they pay` : "no commission yet"}</span>
      </div>
      <p className="text-xs muted">{tier.blurb}</p>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="tile !p-2">
          <div className="text-[11px] muted">Families that paid</div>
          <div className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{payingReferred}</div>
        </div>
        <div className="tile !p-2">
          <div className="text-[11px] muted">They have paid</div>
          <div className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{egpFor(lifetime).toLocaleString()}</div>
        </div>
        <div className="tile !p-2">
          <div className="text-[11px] muted">Earned by you</div>
          <div className="text-xl font-bold text-good" style={{ fontFamily: "var(--font-display)" }}>{egpFor(commissionEarned).toLocaleString()}</div>
        </div>
      </div>
      <p className="text-[11px] muted">In pounds. Commission arrives as credits, which buy months at the same rate.</p>

      {next && (
        <div className="rounded-xl bg-panel-2/60 p-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold">{next.from - payingReferred} more famil{next.from - payingReferred === 1 ? "y" : "ies"} to become a {next.label}</span>
            <span className="muted">{Math.round(next.rate * 100)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-panel">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.round((payingReferred / next.from) * 100))}%` }} />
          </div>
        </div>
      )}

      {referred.length > 0 ? (
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider muted">The families you brought</div>
          <ul className="divide-y divide-line text-sm">
            {referred.map((r) => (
              <li key={r.familyId} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 min-w-0">
                  <span className="truncate font-semibold">{r.name}</span>
                  <span className="block text-[11px] muted">
                    joined {prettyDate(r.joinedOn)} · {r.payments === 0 ? "not paid yet" : `paid ${r.payments} time${r.payments === 1 ? "" : "s"}`}
                    {r.bonusPaid ? " · your free month is in" : ""}
                  </span>
                </span>
                <span className={`badge ${r.live ? "text-good" : r.payments ? "text-warn" : "muted"}`}>{r.live ? "using it" : r.payments ? "lapsed" : "waiting"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm muted">Nobody yet. Send an invitation below; a quarter comes off their first month, and once they pay twice you get a whole month free.</p>
      )}
    </section>
  );
}
