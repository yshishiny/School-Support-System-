import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { prettyDate, todayIn } from "@/lib/dates";
import { loadWallet } from "@/lib/actions/wallet";
import { balances, budgetSplit, categoryLabel, claimTotals, claimable, monthSummary } from "@/lib/wallet";
import { ClaimForm, SpendForm } from "@/components/WalletForms";

const KIND_LINE: Record<string, { sign: string; tone: string; what: string }> = {
  earn: { sign: "+", tone: "text-good", what: "earned" },
  adjust: { sign: "+", tone: "text-good", what: "added" },
  withdraw: { sign: "→", tone: "text-accent-2", what: "handed to you" },
  spend: { sign: "−", tone: "text-warn", what: "spent" },
};

/** The child's own money: what Dad still holds, what is in his pocket, and where the month went. */
export default async function WalletPage() {
  const { profile, family } = await requireStudent();
  const today = todayIn(family.timezone);
  const month = today.slice(0, 7);
  const entries = await loadWallet(profile.id);
  const b = balances(entries);
  const m = monthSummary(entries, month);
  const recent = [...entries].reverse().slice(0, 25);
  const split = budgetSplit(b.inPocket);
  const claims = claimTotals(entries);

  return (
    <main className="space-y-4">
      <header className="flex items-center gap-3">
        <span className="text-4xl">👛</span>
        <div className="flex-1">
          <h1 className="h1">My wallet</h1>
          <p className="text-sm muted">Everything you have earned, what you have taken, and what you spent it on.</p>
        </div>
        <Link href="/allowance" className="btn-ghost btn-sm">Allowance</Link>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="card !p-4">
          <div className="text-xs muted">Kept for you</div>
          <div className="text-[1.7rem] font-bold text-good leading-tight" style={{ fontFamily: "var(--font-display)" }}>{b.withDad} <span className="text-base">EGP</span></div>
          <div className="text-[11px] muted mt-1">Earned but not taken yet. Ask when you want it.</div>
        </div>
        <div className="card !p-4">
          <div className="text-xs muted">In your pocket</div>
          <div className="text-[1.7rem] font-bold text-accent-2 leading-tight" style={{ fontFamily: "var(--font-display)" }}>{b.inPocket} <span className="text-base">EGP</span></div>
          <div className="text-[11px] muted mt-1">Cash you were handed, minus what you spent.</div>
        </div>
      </section>

      <section className="card space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="h2">Everything you own</h2>
          <div className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{b.net} EGP</div>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-panel-2">
          <div className="bg-good" style={{ width: `${b.net ? Math.round((b.withDad / b.net) * 100) : 0}%` }} />
          <div className="bg-accent-2" style={{ width: `${b.net ? Math.round((b.inPocket / b.net) * 100) : 0}%` }} />
        </div>
        <p className="text-xs muted">
          Kept for you {b.withDad} + in your pocket {b.inPocket} = {b.net}. Earned so far {b.earned}, handed over {b.withdrawn}, spent {b.spent}.
          That is a balance sheet: the two sides always agree.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Write down what you spent</h2>
        <SpendForm today={today} />
        <p className="text-xs muted">Write it down the same day and your month adds up. Nobody can guess where money went a week later.</p>
        <p className="text-xs muted">Spent it on the family or on school? Find it in the list below and ask to be paid back.</p>
      </section>

      {claims.count > 0 && (
        <section className="card !py-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="h2">Waiting to be paid back</h2>
            <span className="font-bold text-accent-2">{claims.requested} EGP</span>
          </div>
          <p className="text-xs muted">{claims.count} thing{claims.count === 1 ? "" : "s"} your dad has not decided yet.</p>
        </section>
      )}

      {b.inPocket > 0 && (
        <section className="card space-y-2">
          <h2 className="h2">A plan for the {b.inPocket} EGP you hold</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="tile"><div className="text-lg">🛍️</div><div className="font-bold">{split.spend}</div><div className="text-[11px] muted">to spend</div></div>
            <div className="tile"><div className="text-lg">🏦</div><div className="font-bold">{split.save}</div><div className="text-[11px] muted">to save</div></div>
            <div className="tile"><div className="text-lg">🎁</div><div className="font-bold">{split.give}</div><div className="text-[11px] muted">to give</div></div>
          </div>
          <p className="text-xs muted">Sixty for you now, thirty put away for something bigger, ten given. Keep the saved part and in ten weeks you can buy something you cannot buy today.</p>
        </section>
      )}

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="h2">This month</h2>
          <span className="text-xs muted">{prettyDate(`${month}-01`).slice(3)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="tile"><div className="text-[11px] muted">Came in</div><div className="font-bold text-good">{m.inEgp} EGP</div></div>
          <div className="tile"><div className="text-[11px] muted">Went out</div><div className="font-bold text-warn">{m.outEgp} EGP</div></div>
        </div>
        {m.byCategory.length > 0 ? (
          <div className="space-y-1.5">
            {m.byCategory.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <span>{c.emoji}</span>
                <span className="w-28 shrink-0 truncate">{c.label}</span>
                <div className="h-2 flex-1 rounded-full bg-panel-2 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${c.share}%` }} /></div>
                <span className="w-20 text-end tabular-nums">{c.amount} · {c.share}%</span>
              </div>
            ))}
            {m.biggest && <p className="text-xs muted">Biggest single thing: {m.biggest.label}, {m.biggest.amount} EGP.</p>}
          </div>
        ) : (
          <p className="text-sm muted">Nothing written down yet this month.</p>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="h2">Every line</h2>
        {recent.length === 0 && <p className="text-sm muted">Your wallet is empty. It fills when an allowance week is paid.</p>}
        {recent.map((e) => {
          const k = KIND_LINE[e.kind] ?? KIND_LINE.spend;
          const cat = e.kind === "spend" ? categoryLabel(e.category) : null;
          return (
            <div key={e.id} className="border-b border-line py-1.5 last:border-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-lg">{cat ? cat.emoji : e.kind === "withdraw" ? "🤝" : "💰"}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{e.label}</div>
                  <div className="text-[11px] muted">{prettyDate(e.occurred_on)} · {k.what}</div>
                </div>
                <span className={`shrink-0 font-bold tabular-nums ${k.tone}`}>{k.sign}{e.amount_egp}</span>
              </div>
              {e.claim_status === "requested" && <div className="mt-1 text-[11px] text-accent-2">⏳ Asked to be paid back · waiting for your dad</div>}
              {e.claim_status === "approved" && <div className="mt-1 text-[11px] text-good">✓ Paid back{e.claim_note ? ` · “${e.claim_note}”` : ""}</div>}
              {e.claim_status === "rejected" && <div className="mt-1 text-[11px] text-bad">✗ Not paid back{e.claim_note ? ` · “${e.claim_note}”` : ""}</div>}
              {claimable(e) && <div className="mt-1"><ClaimForm entryId={e.id} label={e.label} amount={e.amount_egp} /></div>}
            </div>
          );
        })}
      </section>
    </main>
  );
}
