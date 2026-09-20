import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { prettyDate, todayIn } from "@/lib/dates";
import { loadWallet } from "@/lib/wallet/ledger";
import { balances, budgetSplit, categoryLabel, claimTotals, claimable, monthSummary, statementDesc } from "@/lib/wallet";
import { ClaimForm, SpendForm } from "@/components/WalletForms";
import { Tabs } from "@/components/Tabs";

/**
 * The child's own money, as a balance sheet: what came in, what went out, what is left, and where that money
 * physically is. The statement underneath shows the running balance after every line, with its date, because
 * "why is my total that number" is only ever answered by the lines that made it.
 */
export default async function WalletPage() {
  const { profile, family } = await requireStudent();
  const today = todayIn(family.timezone);
  const month = today.slice(0, 7);
  const entries = await loadWallet(profile.id);
  const b = balances(entries);
  const m = monthSummary(entries, month);
  const split = budgetSplit(b.inPocket);
  const claims = claimTotals(entries);

  // Balances run over everything; only the printing stops at the last 40 lines.
  const ledger = statementDesc(entries).slice(0, 40);

  /**
   * The balance sheet. It reads as three lines that end in one, so the total is never a number that appeared
   * from nowhere: what came in, what a parent added, what went out, and what is left. Underneath, where that
   * money physically is — and the two sides adding back up to the same total, which is the lesson.
   */
  const sheet = (
    <section className="card space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="h2">Your balance sheet</h2>
        <span className="text-xs muted">to {prettyDate(today)}</span>
      </div>

      <dl className="text-sm">
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt>Earned</dt>
          <dd className="tabular-nums font-semibold text-good">+{b.earned}</dd>
        </div>
        {b.adjusted !== 0 && (
          <div className="flex items-baseline justify-between gap-3 py-1.5">
            <dt>{b.adjusted > 0 ? "Added by a parent" : "Taken back by a parent"}</dt>
            <dd className={`tabular-nums font-semibold ${b.adjusted > 0 ? "text-good" : "text-bad"}`}>{b.adjusted > 0 ? "+" : "−"}{Math.abs(b.adjusted)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt>Spent</dt>
          <dd className={`tabular-nums font-semibold ${b.spent ? "text-warn" : "muted"}`}>{b.spent ? `−${b.spent}` : "0"}</dd>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-line pt-2">
          <dt className="font-bold" style={{ fontFamily: "var(--font-display)" }}>Everything you own</dt>
          <dd className="tabular-nums text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{b.net} <span className="text-sm muted">EGP</span></dd>
        </div>
      </dl>

      <div className="rounded-xl bg-panel-2/60 p-2.5 space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider muted">Where it is right now</div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="tile !p-2">
            <div className="text-[11px] muted">Kept by Dad</div>
            <div className="text-xl font-bold text-good tabular-nums" style={{ fontFamily: "var(--font-display)" }}>{b.withDad}</div>
          </div>
          <div className="tile !p-2">
            <div className="text-[11px] muted">In your pocket</div>
            <div className="text-xl font-bold text-accent-2 tabular-nums" style={{ fontFamily: "var(--font-display)" }}>{b.inPocket}</div>
          </div>
        </div>
        <p className="text-center text-xs muted tabular-nums">{b.withDad} + {b.inPocket} = {b.net} ✓ the two sides always agree</p>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs muted">Nothing in it yet. It fills the first time an allowance week is paid.</p>
      ) : (
        <p className="text-xs muted">
          Dad has handed you {b.withdrawn} EGP so far. Handing it over does not make you richer or poorer — the
          money only moves from his side to yours. You are poorer only when you spend.
        </p>
      )}
    </section>
  );

  const statementTab = (
    <section className="card !py-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="h2">Every line, newest first</h2>
        <span className="text-[11px] muted">balance after each</span>
      </div>
      {ledger.length === 0 && <p className="text-sm muted">Nothing yet. Your wallet fills when an allowance week is paid.</p>}
      <ul className="divide-y divide-line">
        {ledger.map((r) => {
          const cat = r.entry.kind === "spend" ? categoryLabel(r.entry.category) : null;
          const icon = r.kind === "moved" ? "🤝" : cat ? cat.emoji : r.delta < 0 ? "↩️" : "💰";
          const amount = r.kind === "moved" ? `→ ${r.amount}` : r.delta < 0 ? `− ${Math.abs(r.delta)}` : `+ ${r.delta}`;
          const tone = r.kind === "moved" ? "text-accent-2" : r.delta < 0 ? "text-warn" : "text-good";
          return (
            <li key={r.entry.id} className="py-2">
              <div className="flex items-baseline gap-2 text-sm">
                <span className="text-base leading-none">{icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{r.entry.label}</div>
                  <div className="text-[11px] muted">{prettyDate(r.entry.occurred_on)}{r.kind === "moved" ? " · moved to your pocket" : ""}</div>
                </div>
                <span className={`shrink-0 font-bold tabular-nums ${tone}`}>{amount}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-end gap-3 text-[11px] muted tabular-nums">
                <span>Dad {r.withDad}</span>
                <span>pocket {r.inPocket}</span>
                <span className="font-semibold text-ink">total {r.total}</span>
              </div>
              {r.entry.claim_status === "requested" && <div className="mt-1 text-[11px] text-accent-2">⏳ Asked to be paid back · waiting for your dad</div>}
              {r.entry.claim_status === "approved" && <div className="mt-1 text-[11px] text-good">✓ Paid back{r.entry.claim_note ? ` · “${r.entry.claim_note}”` : ""}</div>}
              {r.entry.claim_status === "rejected" && <div className="mt-1 text-[11px] text-bad">✗ Not paid back{r.entry.claim_note ? ` · “${r.entry.claim_note}”` : ""}</div>}
              {claimable(r.entry) && <div className="mt-1"><ClaimForm entryId={r.entry.id} label={r.entry.label} amount={r.entry.amount_egp} /></div>}
            </li>
          );
        })}
      </ul>
    </section>
  );

  // The two numbers are the page. Writing a purchase down, the month's shape and every line each get a tab,
  // so nothing important sits below the fold.
  const spend = (
    <>
      <section className="card space-y-3">
        <h2 className="h2">Write down what you spent</h2>
        <SpendForm today={today} />
        <p className="text-xs muted">Write it down the same day and your month adds up. Nobody can guess where money went a week later.</p>
        <p className="text-xs muted">Spent it on the family or on school? Find it under Every line and ask to be paid back.</p>
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
    </>
  );

  const monthTab = (
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
  );

  return (
    <main className="space-y-3">
      <header className="flex items-center gap-3">
        <span className="text-4xl">👛</span>
        <div className="flex-1 min-w-0">
          <h1 className="h1">My wallet</h1>
          <p className="text-sm muted">What you own, where it is, and every line that got you here.</p>
        </div>
        <Link href="/allowance" className="btn-ghost btn-sm">Allowance</Link>
      </header>

      {sheet}

      <Tabs
        storageKey="wallet"
        tabs={[
          { id: "lines", label: "Statement", emoji: "📜", content: statementTab },
          { id: "spend", label: "Spent", emoji: "🧾", badge: claims.count, content: spend },
          { id: "month", label: "This month", emoji: "📊", content: monthTab },
        ]}
      />
    </main>
  );
}
