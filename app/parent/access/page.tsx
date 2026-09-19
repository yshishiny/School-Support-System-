import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { prettyDate, todayIn } from "@/lib/dates";
import { loadAccess } from "@/lib/actions/access";
import { MAX_INVITES, REFERRAL_CREDITS, accessUntil, egpFor, priceList } from "@/lib/access";
import { BuyAccess, InviteBox } from "@/components/AccessForms";
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

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="h1">The virtual teacher</h1>
        <Link href="/parent" className="btn-ghost btn-sm">← Home</Link>
      </div>

      <section className="card space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="h2">Your credits</h2>
          <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{state.credits.toLocaleString()}</div>
        </div>
        <p className="text-xs muted">Worth about {egpFor(state.credits).toLocaleString()} EGP. Credits buy lesson access; they come from what you pay, and from families you invite.</p>
      </section>

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

      <section className="space-y-2">
        <h2 className="h2">Plans</h2>
        <p className="text-xs muted">A month for one child is 450 EGP. The family plan covers every child in the house and costs less than three separate ones.</p>
        {prices.map(({ plan, egp, perChildPerMonth }) => (
          <div key={plan.id} className="card !py-3 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="flex-1 min-w-0 font-bold" style={{ fontFamily: "var(--font-display)" }}>{plan.label}</span>
              <span className="text-lg font-bold">{egp.toLocaleString()} EGP</span>
            </div>
            <p className="text-xs muted">
              {plan.blurb} · {plan.credits.toLocaleString()} credits
              {perChildPerMonth ? ` · works out at ${perChildPerMonth} EGP a month` : ""}
            </p>
            <BuyAccess planId={plan.id} scope={plan.scope} credits={plan.credits} balance={state.credits} students={students.map((s) => ({ id: s.id, name: s.full_name.split(" ")[0] }))} />
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="h2">Invite two families</h2>
          <p className="text-xs muted">
            You can invite {MAX_INVITES} families. When one of them starts using it, {REFERRAL_CREDITS} credits land in your balance —
            about {egpFor(REFERRAL_CREDITS)} EGP off your next month.
          </p>
        </div>
        <InviteBox invites={state.invites} left={state.invitesLeft} />
      </section>

      <p className="text-xs muted">Credits are granted by the owner of the app. Ask him for more, or use an invite you were sent.</p>
    </main>
  );
}
