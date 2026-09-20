import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { prettyDate, todayIn } from "@/lib/dates";
import { loadAccess } from "@/lib/access/store";
import { WELCOME_DISCOUNT, accessUntil, egpFor, priceAfterWelcome, priceList } from "@/lib/access";
import { BuyAccess, InviteBox } from "@/components/AccessForms";
import { AmbassadorPanel } from "@/components/AmbassadorPanel";
import { Tabs } from "@/components/Tabs";
import type { Profile } from "@/lib/types";

/** What the family has, what a plan costs, and the two invites that pay them back. */
export default async function AccessPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const [{ data: kids }, state] = await Promise.all([
    supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false }),
    loadAccess(family.id),
  ]);
  const students = (kids ?? []) as Profile[];
  const prices = priceList();
  const welcome = !!state.invitedBy && !state.welcomeUsed;

  const plans = (
    <section className="space-y-2">
      <p className="text-xs muted">A month for one child is 450 EGP. The family plan covers every child in the house and costs less than three separate ones.</p>
      {prices.map(({ plan, egp, perChildPerMonth }) => {
        const price = welcome ? priceAfterWelcome(plan.credits, false) : plan.credits;
        return (
          <div key={plan.id} className="card !py-3 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="flex-1 min-w-0 font-bold" style={{ fontFamily: "var(--font-display)" }}>{plan.label}</span>
              {welcome && <span className="text-sm muted line-through">{egp.toLocaleString()}</span>}
              <span className="text-lg font-bold">{egpFor(price).toLocaleString()} EGP</span>
            </div>
            <p className="text-xs muted">
              {plan.blurb} · {price.toLocaleString()} credits
              {perChildPerMonth ? ` · works out at ${perChildPerMonth} EGP a month` : ""}
            </p>
            <BuyAccess planId={plan.id} scope={plan.scope} credits={price} balance={state.credits} students={students.map((s) => ({ id: s.id, name: s.full_name.split(" ")[0] }))} />
          </div>
        );
      })}
      <p className="text-xs muted">Credits are granted by the owner of the app. Ask him for more, or use an invite you were sent.</p>
    </section>
  );

  const who = (
    <section className="card space-y-2">
      <h2 className="h2">Who can use it now</h2>
      {students.length === 0 && <p className="text-sm muted">No children yet.</p>}
      <ul className="divide-y divide-line text-sm">
        {students.map((s) => {
          const until = accessUntil(state.grants, s.id, today);
          return (
            <li key={s.id} className="flex items-center gap-2 py-1.5">
              <span className="text-lg">{s.avatar_emoji}</span>
              <span className="flex-1 min-w-0 truncate font-semibold">{s.full_name.split(" ")[0]}</span>
              {until ? <span className="badge text-good">until {prettyDate(until)}</span> : <span className="badge muted">no access</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );

  const earn = (
    <>
      <AmbassadorPanel view={{ tier: state.tier, payingReferred: state.payingReferred, commissionEarned: state.commissionEarned, referred: state.referred }} />
      <section className="card space-y-3">
        <div>
          <h2 className="h2">Invitations</h2>
          <p className="text-xs muted">
            A quarter comes off their first month. Once they have paid twice — a family that stayed, not one that
            just signed — a whole free month lands in your balance. Every family that joins and pays earns you two
            more invitations.
          </p>
        </div>
        <InviteBox invites={state.invites} left={state.invitesLeft} />
      </section>
    </>
  );

  return (
    <main className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="h1">The virtual teacher</h1>
        <Link href="/parent" className="btn-ghost btn-sm">← Home</Link>
      </div>

      <section className="card space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="h2">Your credits</h2>
          <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{state.credits.toLocaleString()}</div>
        </div>
        <p className="text-xs muted">Worth about {egpFor(state.credits).toLocaleString()} EGP. Credits buy lesson access; they come from what you pay, and from families you invite.</p>
        {welcome && (
          <p className="text-xs text-good">You came in on an invitation, so {Math.round(WELCOME_DISCOUNT * 100)}% comes off your first purchase.</p>
        )}
      </section>

      <Tabs
        storageKey="access"
        tabs={[
          { id: "plans", label: "Plans", emoji: "💳", content: plans },
          { id: "who", label: "Who has it", emoji: "👧", content: who },
          { id: "earn", label: "Earn", emoji: "🤝", badge: state.payingReferred, content: earn },
        ]}
      />
    </main>
  );
}
