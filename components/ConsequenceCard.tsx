import { claimEarnBackAction } from "@/lib/actions/allowance";
import { practiceByCode } from "@/lib/allowance";
import { prettyDate } from "@/lib/dates";
import type { Consequence } from "@/lib/types";

/** What the child sees: the consequence, why, until when, and the way back. */
export function ConsequenceCard({ items }: { items: Consequence[] }) {
  if (items.length === 0) return null;
  return (
    <section className="card border-warn/50 space-y-2">
      <h2 className="h2">🪞 Make it right</h2>
      {items.map((c) => {
        const def = practiceByCode(c.code);
        return (
          <div key={c.id} className="tile space-y-1">
            <div className="flex items-center gap-2"><span className="text-2xl">{def?.emoji ?? "⚠️"}</span><div className="flex-1"><div className="font-bold">{c.label}</div><div className="text-xs muted">until {prettyDate(c.ends_on)}{c.reason ? ` · ${c.reason}` : ""}</div></div></div>
            {c.earn_back_task && <div className="text-sm"><b>Way back:</b> {c.earn_back_task}</div>}
            {c.student_claimed_at ? (
              <span className="badge text-warn">Waiting for a parent to confirm</span>
            ) : (
              <form action={claimEarnBackAction.bind(null, c.id)}><button className="btn-ghost btn-sm">I did the way back</button></form>
            )}
          </div>
        );
      })}
    </section>
  );
}
