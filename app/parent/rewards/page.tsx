import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AddRewardForm } from "@/components/AddRewardForm";
import { Tabs } from "@/components/Tabs";
import { adjustPointsAction, decideRedemptionAction, enableRewardTemplateAction, toggleRewardAction } from "@/lib/actions/rewards";
import { REWARD_TEMPLATES, TEMPLATE_GROUPS } from "@/lib/reward-templates";
import { POINTS } from "@/lib/points";
import type { Profile, Redemption, Reward } from "@/lib/types";

export default async function ParentRewardsPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const [{ data: rewards }, { data: kids }, { data: redemptions }, { data: ledger }] = await Promise.all([
    supabase.from("rewards").select("*").eq("family_id", family.id).order("cost_points"),
    supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false }),
    supabase.from("redemptions").select("*, rewards(title, emoji), profiles(full_name)").order("requested_at", { ascending: false }).limit(20),
    supabase.from("points_ledger").select("student_id, delta"),
  ]);
  const students = (kids ?? []) as Profile[];
  const reds = (redemptions ?? []) as (Redemption & { rewards: { title: string; emoji: string } | null; profiles: { full_name: string } | null })[];

  return (
    <main className="space-y-4">
      <h1 className="h1">Rewards</h1>
      <p className="muted text-sm">
        A daily check-in pays {POINTS.CHECKIN}, homework on time {POINTS.HOMEWORK_ON_TIME} each, a full day {POINTS.ALL_DONE_BONUS} bonus. A good week is roughly 150 to 250 points, so price rewards accordingly.
      </p>

      <Tabs
        storageKey="rewards"
        tabs={[
          { id: "requests", label: "Requests", emoji: "🙋", badge: reds.filter((r) => r.status === "pending").length || null, content: (<>
      {reds.length > 0 && (
        <section className="card">
          <h2 className="h2 mb-2">Requests</h2>
          <ul className="divide-y divide-line text-sm">
            {reds.map((r) => (
              <li key={r.id} className="py-2 flex items-center gap-2">
                <div className="flex-1">
                  <b>{r.profiles?.full_name}</b> · {r.rewards?.emoji} {r.rewards?.title} · {r.points_spent} pts
                  <div className="text-xs muted">{String(r.requested_at).slice(0, 10)} · {r.status}</div>
                </div>
                {r.status === "pending" && (
                  <>
                    <form action={decideRedemptionAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approved" /><button className="btn-primary btn-sm">Approve</button></form>
                    <form action={decideRedemptionAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="rejected" /><button className="btn-ghost btn-sm">Reject</button></form>
                  </>
                )}
                {r.status === "approved" && (
                  <form action={decideRedemptionAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="delivered" /><button className="btn-ghost btn-sm">Mark given</button></form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
            {reds.length === 0 && <p className="card text-sm muted">No requests yet.</p>}
          </>) },
          { id: "catalog", label: "Catalog", emoji: "🎁", content: (<>
      <section className="card">
        <h2 className="h2 mb-2">Catalog</h2>
        <ul className="divide-y divide-line">
          {((rewards ?? []) as Reward[]).map((r) => (
            <li key={r.id} className={`py-2 flex items-center gap-2 ${r.active ? "" : "opacity-50"}`}>
              <span className="text-2xl">{r.emoji}</span>
              <div className="flex-1">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs muted">{r.kind}{r.cash_amount_egp ? ` · ${Number(r.cash_amount_egp)} EGP` : ""} · {r.cost_points} pts</div>
              </div>
              <form action={toggleRewardAction}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="active" value={r.active ? "false" : "true"} />
                <button className="btn-ghost btn-sm">{r.active ? "Hide" : "Show"}</button>
              </form>
            </li>
          ))}
          {(rewards ?? []).length === 0 && <li className="muted text-sm">No rewards yet. Mix cash (e.g. 500 EGP for 1500 pts) with privileges (game time, a night out) and things they want.</li>}
        </ul>
      </section>

      <AddRewardForm />

          </>) },
          { id: "ideas", label: "Ideas", emoji: "💡", content: (<>
      <section className="card space-y-2">
        <h2 className="h2">Ideas, off by default</h2>
        <p className="text-xs muted">Tap Enable to add one to the catalog. Prices are suggestions; edit after enabling by hiding and re-adding.</p>
        {(Object.keys(TEMPLATE_GROUPS) as (keyof typeof TEMPLATE_GROUPS)[]).map((g) => (
          <div key={g}>
            <div className="text-xs font-bold muted mt-2 mb-1">{TEMPLATE_GROUPS[g]}</div>
            <ul className="divide-y divide-line">
              {REWARD_TEMPLATES.filter((t) => t.group === g).map((t) => {
                const on = ((rewards ?? []) as Reward[]).some((r) => r.title === t.title);
                return (
                  <li key={t.key} className="py-1.5 flex items-center gap-2 text-sm">
                    <span className="text-xl">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{t.title} <span className="muted font-normal text-xs">· {t.cost_points} pts{t.cash_amount_egp ? ` · ${t.cash_amount_egp} EGP` : ""}</span></div>
                      <div className="text-xs muted truncate">{t.description}</div>
                    </div>
                    {on ? <span className="badge text-good">in catalog</span> : (
                      <form action={enableRewardTemplateAction}><input type="hidden" name="key" value={t.key} /><button className="btn-ghost btn-sm">Enable</button></form>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

          </>) },
          { id: "balances", label: "Balances", emoji: "⭐", content: (<>
      <section className="card">
        <h2 className="h2 mb-2">Balances</h2>
        {students.map((s) => (
          <div key={s.id} className="py-2 border-t border-line first:border-0 flex items-center gap-2">
            <span className="flex-1">{s.avatar_emoji} {s.full_name}</span>
            <b className="text-accent-2">{(ledger ?? []).filter((l) => l.student_id === s.id).reduce((a, l) => a + l.delta, 0)} ⭐</b>
            <form action={adjustPointsAction} className="flex gap-1">
              <input type="hidden" name="student_id" value={s.id} />
              <input name="delta" type="number" className="input w-20 py-1" placeholder="±pts" required />
              <input name="reason" className="input w-32 py-1" placeholder="reason" required />
              <button className="btn-ghost btn-sm">Apply</button>
            </form>
          </div>
        ))}
      </section>

          </>) },
        ]}
      />
    </main>
  );
}
