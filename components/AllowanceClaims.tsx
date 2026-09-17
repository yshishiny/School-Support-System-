"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimAllowanceAction } from "@/lib/actions/allowance";
import { setTargetRewardAction } from "@/lib/actions/rewards";
import { prettyDate } from "@/lib/dates";

export interface ClosedWeek { id: string; week_start: string; week_end: string; score: number; band: string; amount: number; claimed_at: string | null; paid_at: string | null }

/** Closed weeks the child can claim, and what is waiting for the parent. */
export function AllowanceClaims({ weeks }: { weeks: ClosedWeek[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (weeks.length === 0) return null;
  return (
    <section className="card space-y-2">
      <h2 className="h2">💵 Claim your allowance</h2>
      <ul className="text-sm divide-y divide-line">
        {weeks.map((w) => (
          <li key={w.id} className="py-1.5 flex items-center gap-2">
            <span className="flex-1">{prettyDate(w.week_start)} → {prettyDate(w.week_end)} · score {w.score} · <b>{w.amount} EGP</b></span>
            {w.paid_at ? <span className="badge text-good">paid ✓</span> : w.claimed_at ? <span className="badge text-warn">claimed · waiting</span> : w.amount > 0 ? (
              <button type="button" disabled={pending} className="btn-primary btn-sm" onClick={() => start(async () => { const r = await claimAllowanceAction(w.id); setMsg(r.error ?? r.ok ?? null); router.refresh(); })}>Claim</button>
            ) : <span className="badge text-bad">0 EGP</span>}
          </li>
        ))}
      </ul>
      {msg && <p className="text-xs muted">{msg}</p>}
    </section>
  );
}

/** "Set as my target" on a reward card. */
export function TargetButton({ rewardId, isTarget }: { rewardId: string; isTarget: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className={`text-xs ${isTarget ? "text-accent-2 font-semibold" : "muted underline"}`} onClick={() => start(async () => { await setTargetRewardAction(isTarget ? null : rewardId); router.refresh(); })}>
      {isTarget ? "🎯 my target" : "set as target"}
    </button>
  );
}
