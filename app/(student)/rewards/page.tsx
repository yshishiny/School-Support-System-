import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RedeemButton } from "@/components/RedeemButton";
import Link from "next/link";
import { TargetButton } from "@/components/AllowanceClaims";
import { fullWeekStreak } from "@/lib/actions/rewards";
import { PointsGuide } from "@/components/PointsGuide";
import { Tabs } from "@/components/Tabs";
import { allowanceWeekStatus } from "@/lib/allowance/week";
import type { PointsEntry, Redemption, Reward } from "@/lib/types";

export default async function RewardsPage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const [{ data: rewards }, { data: ledger }, { data: redemptions }] = await Promise.all([
    supabase.from("rewards").select("*").eq("family_id", family.id).eq("active", true).order("cost_points"),
    supabase.from("points_ledger").select("*").eq("student_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("redemptions").select("*, rewards(title, emoji)").eq("student_id", profile.id).order("requested_at", { ascending: false }),
  ]);
  const entries = (ledger ?? []) as PointsEntry[];
  const balance = entries.reduce((s, r) => s + r.delta, 0);
  const reds = (redemptions ?? []) as (Redemption & { rewards: { title: string; emoji: string } | null })[];
  const held = reds.filter((r) => r.status === "pending").reduce((s, r) => s + r.points_spent, 0);
  const available = balance - held;
  const allowance = family.allowance_enabled ? await allowanceWeekStatus(profile.id, family).catch(() => null) : null;
  const streakFull = await fullWeekStreak(profile.id);
  const target = ((rewards ?? []) as Reward[]).find((r) => r.id === (profile as { target_reward_id?: string | null }).target_reward_id) ?? null;

  const list = (rewards ?? []) as Reward[];
  const shop = (
    <section className="grid grid-cols-2 gap-3">
      {list.map((r) => (
        <div key={r.id} className={`card flex flex-col gap-2 ${target?.id === r.id ? "border-accent/60" : ""}`}>
          <div className="text-3xl">{r.emoji}</div>
          <div className="font-bold leading-tight">{r.title}</div>
          {r.description && <div className="text-xs muted">{r.description}</div>}
          {r.kind === "cash" && r.cash_amount_egp && <div className="text-xs text-good">{Number(r.cash_amount_egp)} EGP</div>}
          {(r.requires_full_weeks ?? 0) > 0 && <div className="text-xs text-warn">Extra effort: {r.requires_full_weeks} full week{r.requires_full_weeks === 1 ? "" : "s"} in a row ({streakFull} so far){r.effort_note ? ` · ${r.effort_note}` : ""}</div>}
          <div className="mt-auto pt-1 space-y-1">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold">{r.cost_points} ⭐</span><TargetButton rewardId={r.id} isTarget={target?.id === r.id} /></div>
            <RedeemButton rewardId={r.id} disabled={available < r.cost_points || streakFull < (r.requires_full_weeks ?? 0)} />
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="card muted col-span-2">No rewards yet. Ask your parent to add some.</p>}
    </section>
  );
  const requests = (
    <section className="card">
      {reds.length === 0 ? <p className="text-sm muted">No requests yet. Pick a reward in the Shop when you have the points.</p> : (
        <ul className="text-sm space-y-1">
          {reds.slice(0, 15).map((r) => (
            <li key={r.id} className="flex justify-between gap-2">
              <span>{r.rewards?.emoji} {r.rewards?.title} <span className="muted text-xs">· {r.points_spent} ⭐</span></span>
              <span className={`badge ${r.status === "approved" || r.status === "delivered" ? "text-good" : r.status === "rejected" ? "text-bad" : "text-warn"}`}>{r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  const points = (
    <div className="space-y-3">
      <PointsGuide compact />
      <section className="card">
        <h2 className="h2 mb-2">Points history</h2>
        <ul className="text-sm divide-y divide-line">
          {entries.slice(0, 20).map((e) => (
            <li key={e.id} className="py-1.5 flex justify-between gap-2">
              <span className="muted">{e.reason}</span>
              <span className={e.delta >= 0 ? "text-good font-semibold" : "text-bad font-semibold"}>{e.delta >= 0 ? "+" : ""}{e.delta}</span>
            </li>
          ))}
          {entries.length === 0 && <li className="muted py-1.5">Submit your first check-in to start earning.</li>}
        </ul>
      </section>
    </div>
  );

  return (
    <main className="space-y-4">
      <header className="card flex items-center justify-between">
        <div>
          <h1 className="h1">Rewards</h1>
          <p className="muted text-sm">{held > 0 ? `${held} pts waiting for approval` : "Spend your points"}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold text-accent-2">{available}</div>
          <div className="text-xs muted">points available</div>
        </div>
      </header>

      {target && (
        <section className="card !py-3 border-accent/60 space-y-1">
          <div className="text-sm font-semibold">🎯 Target: {target.emoji} {target.title}</div>
          <div className="h-2 rounded-full bg-panel-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${Math.min(100, Math.round((available / target.cost_points) * 100))}%` }} /></div>
          <div className="text-xs muted">{available}/{target.cost_points} ⭐{(target.requires_full_weeks ?? 0) > 0 ? ` · full-allowance weeks in a row: ${streakFull}/${target.requires_full_weeks}` : ""}{target.effort_note ? ` · ${target.effort_note}` : ""}</div>
        </section>
      )}
      {allowance && (
        <Link href="/allowance" className="card !py-2.5 flex items-center gap-3 border-accent/40">
          <span className="text-2xl">💵</span>
          <div className="flex-1 min-w-0 text-sm"><b>Allowance {allowance.amount} of {allowance.allowance} EGP</b> <span className="muted">· how to get all of it</span></div>
          <span className="btn-ghost btn-sm">Open</span>
        </Link>
      )}

      <Tabs
        storageKey="rewards-kid"
        tabs={[
          { id: "shop", label: "Shop", emoji: "🛍️", badge: list.length || null, content: shop },
          { id: "requests", label: "My requests", emoji: "📬", badge: reds.filter((r) => r.status === "pending").length || null, content: requests },
          { id: "points", label: "Points", emoji: "⭐", content: points },
        ]}
      />
    </main>
  );
}
