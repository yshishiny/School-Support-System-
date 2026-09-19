import Link from "next/link";
import { Tabs } from "@/components/Tabs";
import { SideTabs } from "@/components/SideTabs";
import { kidColor } from "@/lib/kid-tabs";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_KPIS, PRACTICES, mergeKpis } from "@/lib/allowance";
import { allowanceWeekStatus } from "@/lib/allowance/week";
import { assignConsequenceAction, closeConsequenceAction, markAllowancePaidAction, saveAllowanceSettingsAction } from "@/lib/actions/allowance";
import { AllowanceMeter } from "@/components/AllowanceMeter";
import { prettyDate, todayIn } from "@/lib/dates";
import { ParentWalletForms } from "@/components/WalletForms";
import { loadWallet } from "@/lib/actions/wallet";
import { balances } from "@/lib/wallet";
import type { Consequence, Profile } from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function AllowancePage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const [{ data: kids }, { data: weeks }, { data: cons }] = await Promise.all([
    supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false }),
    supabase.from("allowance_weeks").select("*").eq("family_id", family.id).order("week_start", { ascending: false }).limit(20),
    supabase.from("consequences").select("*").eq("family_id", family.id).is("closed_at", null).order("created_at", { ascending: false }),
  ]);
  const students = (kids ?? []) as Profile[];
  const statuses = await Promise.all(students.map((s) => allowanceWeekStatus(s.id, family)));
  const wallets = await Promise.all(students.map(async (s) => ({ id: s.id, name: s.full_name.split(" ")[0], b: balances(await loadWallet(s.id)) })));
  const kpis = mergeKpis(family.allowance_kpis);
  const enabledPractices = PRACTICES.filter((p) => family.practices_enabled.includes(p.code));
  const open = (cons ?? []) as Consequence[];

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Allowance and consequences</h1>
        <Link href="/parent" className="btn-ghost btn-sm">← Home</Link>
      </div>

      {!family.allowance_enabled && (
        <p className="card text-sm border-warn/60"><b>Allowance is off.</b> Turn it on below; the boys then see the meter on their home page and the week closes automatically the morning after pay day.</p>
      )}

      <Tabs
        storageKey="allowance"
        tabs={[
          { id: "kids", label: "This week", emoji: "💵", content: (<>
      <SideTabs storageKey="allowance-kids" tabs={students.map((s, i) => ({ id: s.id, label: s.full_name.split(" ")[0], emoji: s.avatar_emoji, color: kidColor(i), sub: `${statuses[i].amount} EGP · ${statuses[i].score}`, content: <AllowanceMeter status={statuses[i]} /> }))} />
          </>) },
          { id: "wallets", label: "Wallets", emoji: "👛", content: (
      <section className="card space-y-4">
        <div>
          <h2 className="h2">What each of them is owed</h2>
          <p className="text-xs muted">A paid allowance week and a cash reward land here and stay held until you hand the money over. Say when you do, and his wallet shows it as taken on that day — so he learns a balance that has two sides.</p>
        </div>
        {wallets.map((w) => (
          <div key={w.id} className="tile space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <span className="font-bold">{w.name}</span>
              <span>held <b className="text-good">{w.b.withDad} EGP</b></span>
              <span className="muted">in his pocket {w.b.inPocket}</span>
              <span className="muted">spent {w.b.spent}</span>
              <span className="muted">owns {w.b.net}</span>
            </div>
            <ParentWalletForms studentId={w.id} name={w.name} today={today} />
          </div>
        ))}
      </section>
          ) },
          { id: "history", label: "History", emoji: "🗓️", badge: (weeks ?? []).filter((w) => !w.paid_at && w.claimed_at).length || null, content: (<>
      <section className="card space-y-3">
        <h2 className="h2">History</h2>
        {(weeks ?? []).length === 0 ? <p className="text-sm muted">The first week closes the morning after pay day.</p> : (
          <ul className="text-sm divide-y divide-line">
            {(weeks ?? []).map((w) => {
              const s = students.find((x) => x.id === w.student_id);
              return (
                <li key={w.id} className="py-2 flex items-center gap-2">
                  <span className="flex-1">{s?.avatar_emoji} {s?.full_name.split(" ")[0]} · {prettyDate(w.week_start)} → {prettyDate(w.week_end)} · score {w.score} · <b>{w.amount} EGP</b></span>
                  {w.claimed_at && !w.paid_at && <span className="badge text-warn">claimed</span>}
                  {w.paid_at ? <span className="badge text-good">paid</span> : (
                    <form action={markAllowancePaidAction.bind(null, w.id)}><button className="btn-ghost btn-sm">Mark paid</button></form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

          </>) },
          { id: "consequences", label: "Consequences", emoji: "🪞", badge: open.length || null, content: (<>
      <section className="card space-y-3">
        <h2 className="h2">Assign a consequence</h2>
        {enabledPractices.length === 0 ? <p className="text-sm muted">Enable some in Settings first.</p> : (
          <form action={assignConsequenceAction} className="grid gap-2 sm:grid-cols-2">
            <select name="student_id" className="input">{students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
            <select name="code" className="input">{enabledPractices.map((p) => <option key={p.code} value={p.code}>{p.emoji} {p.label}</option>)}</select>
            <input name="reason" className="input" placeholder="Why (he sees this)" maxLength={300} />
            <input name="days" type="number" min={1} max={14} className="input" placeholder="Days (default per practice)" />
            <input name="earn_back" className="input sm:col-span-2" placeholder="Earn-back task (optional; default per practice)" maxLength={300} />
            <button className="btn-primary sm:col-span-2">Assign</button>
          </form>
        )}
        {open.length > 0 && (
          <ul className="divide-y divide-line text-sm">
            {open.map((c) => {
              const s = students.find((x) => x.id === c.student_id);
              return (
                <li key={c.id} className="py-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex-1"><b>{s?.full_name.split(" ")[0]}</b> · {c.label} · until {prettyDate(c.ends_on)}{c.reason ? ` · ${c.reason}` : ""}</span>
                    {c.student_claimed_at && <span className="badge text-warn">says earn-back done</span>}
                  </div>
                  <div className="text-xs muted">Way back: {c.earn_back_task}</div>
                  <div className="flex gap-2">
                    <form action={closeConsequenceAction.bind(null, c.id, true)}><button className="btn-ghost btn-sm">Earned back, close</button></form>
                    <form action={closeConsequenceAction.bind(null, c.id, false)}><button className="text-xs muted">Close (served)</button></form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
          </>) },
          { id: "settings", label: "Settings", emoji: "⚙️", content: (<>
      <form action={saveAllowanceSettingsAction} className="card space-y-3">
        <h2 className="h2">Settings</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={family.allowance_enabled} /> Allowance is earned through the basics</label>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">Amount (EGP)</label><input name="amount" type="number" min={0} className="input" defaultValue={family.allowance_amount} /></div>
          <div><label className="label">Pay day</label>
            <select name="pay_weekday" className="input" defaultValue={family.allowance_pay_weekday}>{DAYS.map((d, k) => <option key={d} value={k}>{d}</option>)}</select>
          </div>
        </div>
        <div>
          <div className="label">Basics (KPIs) and weights · bands: 90+ full, 70+ pays 70%, 50+ pays 40%, under 50 nothing</div>
          <ul className="divide-y divide-line">
            {DEFAULT_KPIS.map((k) => {
              const cur = kpis.find((x) => x.code === k.code)!;
              return (
                <li key={k.code} className="py-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`on_${k.code}`} defaultChecked={cur.enabled} />
                  <span className="text-lg">{k.emoji}</span>
                  <div className="flex-1 min-w-0"><div className="font-medium">{k.label}</div><div className="text-xs muted">{k.source === "parent" ? "You judge, one tap a day" : "Counted by the app"} · {k.hint}</div></div>
                  <input name={`weight_${k.code}`} type="number" min={0} max={50} className="input w-16 py-1 text-center" defaultValue={cur.weight} />
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-xs muted">📸 Snap tasks (bed, desk, dish, homework page, handwriting) are basics too. Switch them on and set their weights on the <Link href="/parent/snaps" className="underline">Show your win</Link> page.</p>
        <div>
          <div className="label">Consequences you want available (off by default; never schoolwork)</div>
          <ul className="divide-y divide-line">
            {PRACTICES.map((p) => (
              <li key={p.code} className="py-2 flex items-start gap-2 text-sm">
                <input type="checkbox" name={`practice_${p.code}`} defaultChecked={family.practices_enabled.includes(p.code)} className="mt-1" />
                <span className="text-lg">{p.emoji}</span>
                <div className="flex-1"><div className="font-medium">{p.label} <span className="muted font-normal text-xs">· {p.days} day{p.days === 1 ? "" : "s"}</span></div><div className="text-xs muted">{p.description} Way back: {p.earnBack}</div></div>
              </li>
            ))}
          </ul>
        </div>
        <button className="btn-primary w-full">Save</button>
      </form>

          </>) },
        ]}
      />
      <p className="text-xs muted">Today is {prettyDate(today)}. Daily ✓/✗ taps live on your Home page under each child.</p>
    </main>
  );
}
