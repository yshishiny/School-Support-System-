import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { traceSummaries } from "@/lib/trace/load";

export const dynamic = "force-dynamic";

/**
 * The chooser, and nothing else.
 *
 * It used to be this page and every child's detail at once, in a strip of tabs: choosing a child left three
 * quarters of the screen showing his siblings and a column of menu items. A parent opening "Youssef" is not
 * browsing. So this page answers one question — who needs me, and for how much — and every row is a door.
 */
export default async function TracePage() {
  const { family } = await requireParent();
  const kids = await traceSummaries(family);

  if (kids.length === 0) {
    return (
      <main className="space-y-4">
        <h1 className="h1">Money and proof</h1>
        <p className="card text-sm muted">No children yet. Add them under Kids.</p>
      </main>
    );
  }

  const total = kids.reduce((n, k) => n + k.owed.ifSettled, 0);

  return (
    <main className="space-y-4">
      <div>
        <h1 className="h1">Money and proof</h1>
        <p className="muted text-sm mt-1">
          {total > 0 ? <>You are holding <b className="text-accent-2">{total} EGP</b> across {kids.filter((k) => k.owed.ifSettled > 0).length} of {kids.length} children.</> : "Nothing is owed to anyone right now."}
          {" "}Open a child for the full account.
        </p>
      </div>

      <ul className="space-y-2">
        {kids.map((k) => {
          const quiet = k.activeDays === 0;
          return (
            <li key={k.id}>
              <Link
                href={`/parent/trace/${k.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-line bg-panel px-4 py-3.5 transition hover:border-accent/60"
              >
                <span className="h-12 w-12 shrink-0 rounded-full overflow-hidden border border-line bg-panel-2 grid place-items-center text-2xl">
                  {k.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={k.avatar} alt="" className="h-full w-full object-cover" />
                  ) : k.emoji}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-base leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                    {k.name}
                    {k.grade !== null && <span className="muted font-normal text-sm"> · Grade {k.grade}</span>}
                  </span>
                  <span className={`block text-xs mt-0.5 ${quiet ? "text-bad" : "muted"}`}>
                    {quiet
                      ? `Nothing recorded in ${k.elapsedDays} day${k.elapsedDays === 1 ? "" : "s"} this week`
                      : `Active ${k.activeDays} of ${k.elapsedDays} days · score ${k.score}`}
                    {k.blocked && " · no snap, so it pays nothing"}
                    {k.requests > 0 && ` · ${k.requests} request${k.requests === 1 ? "" : "s"} waiting`}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className={`block font-bold text-lg leading-none ${k.owed.ifSettled > 0 ? "text-accent-2" : "muted"}`} style={{ fontFamily: "var(--font-display)" }}>
                    {k.owed.ifSettled} <span className="text-xs font-semibold">EGP</span>
                  </span>
                  <span className="block text-[11px] muted mt-1">{k.points} points</span>
                </span>

                <span className="shrink-0 muted text-xl leading-none transition group-hover:text-accent-2" aria-hidden>›</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-xs muted">
        Points buy rewards at the price in the catalog. Only a paid allowance week or a cash reward becomes money.
      </p>
    </main>
  );
}
