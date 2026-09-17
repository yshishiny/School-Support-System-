import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, prettyDate } from "@/lib/dates";
import { BANDS, allowancePlan, bandFor, whyThisAmount } from "@/lib/allowance";
import { allowanceWeekStatus } from "@/lib/allowance/week";
import { AllowanceClaims, type ClosedWeek } from "@/components/AllowanceClaims";
import { ConsequenceCard } from "@/components/ConsequenceCard";
import { fullWeekStreak } from "@/lib/actions/rewards";
import type { Consequence, Reward } from "@/lib/types";

/** The child's allowance page: how much this week, why, how to get the full amount, and what extra he can do. */
export default async function AllowancePage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  if (!family.allowance_enabled) {
    return (
      <main className="space-y-4">
        <h1 className="h1">💵 Allowance</h1>
        <p className="card text-sm muted">Your parents have not switched the weekly allowance on yet. When they do, this page shows you every week how to earn all of it.</p>
      </main>
    );
  }
  const [status, { data: closedWeeks }, { data: consequences }, { data: rewards }, streakFull] = await Promise.all([
    allowanceWeekStatus(profile.id, family),
    supabase.from("allowance_weeks").select("id, week_start, week_end, score, band, amount, claimed_at, paid_at").eq("student_id", profile.id).order("week_start", { ascending: false }).limit(8),
    supabase.from("consequences").select("*").eq("student_id", profile.id).is("closed_at", null).gte("ends_on", today).order("ends_on"),
    supabase.from("rewards").select("*").eq("family_id", family.id).eq("active", true).gt("requires_full_weeks", 0).order("cost_points"),
    fullWeekStreak(profile.id),
  ]);
  const plan = allowancePlan(status);
  const now = bandFor(status.score);
  const best = bandFor(status.maxScore);
  const daysLeft = status.totalDays - status.elapsedDays;
  const color = status.band === "full" ? "bg-good" : status.band === "most" ? "bg-accent" : status.band === "some" ? "bg-warn" : "bg-bad";
  const todoPoints = Math.round(plan.todo.reduce((s, p) => s + p.atStake, 0));
  const extras = (rewards ?? []) as Reward[];
  const open = (consequences ?? []) as Consequence[];

  return (
    <main className="space-y-4">
      <header className="flex items-center gap-3">
        <span className="text-4xl sticker-still">💵</span>
        <div className="flex-1">
          <h1 className="h1">Allowance</h1>
          <p className="text-sm muted">Week {prettyDate(status.start)} → {prettyDate(status.end)} · pay day in {daysLeft} day{daysLeft === 1 ? "" : "s"}</p>
        </div>
        <Link href="/rewards" className="btn-ghost btn-sm">Rewards</Link>
      </header>

      {/* 1. This week */}
      <section className="card space-y-2">
        <div className="flex items-end gap-3">
          <div className="text-5xl font-extrabold text-accent-2" style={{ fontFamily: "var(--font-display)" }}>{status.amount}<span className="text-base muted font-semibold"> of {status.allowance} EGP</span></div>
          <div className="text-sm muted pb-1">{now.label} · score {status.score}/100</div>
        </div>
        <div className="h-3 rounded-full bg-panel-2 overflow-hidden relative">
          <div className={`h-full ${color} transition-all`} style={{ width: `${status.score}%` }} />
          {BANDS.filter((x) => x.min > 0).map((x) => <span key={x.band} className="absolute top-0 h-full w-0.5 bg-ink/40" style={{ left: `${x.min}%` }} title={`${x.label} from ${x.min}`} />)}
        </div>
        <div className="grid grid-cols-4 gap-1 text-[11px] text-center">
          {BANDS.slice().reverse().map((b) => (
            <div key={b.band} className={`tile !p-1.5 ${b.band === status.band ? "ring-2 ring-accent" : ""}`}>
              <div className="font-bold">{b.min === 0 ? "< 50" : `${b.min}+`}</div>
              <div className="muted">{Math.round(status.allowance * b.share)} EGP</div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Why this amount */}
      <section className="card space-y-1">
        <h2 className="h2">🧐 Why {status.amount} EGP right now</h2>
        <p className="text-sm">{whyThisAmount(status, status.allowance)}</p>
        <p className="text-xs muted">The score is your basics so far this week, out of 100. It moves every day: a good day lifts it, a ✗ from a parent lowers it.</p>
      </section>

      {/* 3. How to get the full allowance */}
      <section className="card space-y-2">
        <h2 className="h2">{status.band === "full" && plan.todo.length === 0 ? "✅ You are on the full allowance" : `🎯 How to get ${best.band === "full" ? `the full ${status.allowance}` : `to ${Math.round(status.allowance * best.share)}`} EGP`}</h2>
        {plan.todo.length === 0 ? (
          <p className="text-sm muted">Nothing to catch up. Keep going: check in, log every class, prayers, today&apos;s quiz, and your snaps.</p>
        ) : (
          <>
            <p className="text-xs muted">Most valuable first. These {todoPoints} points are still yours to take before pay day.</p>
            <ul className="divide-y divide-line">
              {plan.todo.map((p) => (
                <li key={p.code} className="py-2 flex items-center gap-3">
                  <span className="text-2xl">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-tight">{p.how}</div>
                    <div className="text-xs muted">{p.label} · {p.detail}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="badge text-warn">+{p.atStake}</div>
                    {p.href && <Link href={p.href} className="btn-primary btn-sm mt-1 block">{p.cta}</Link>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {plan.protect.length > 0 && (
          <div className="rounded-xl border border-warn/50 bg-warn/10 p-2.5 text-sm space-y-1">
            <div className="font-semibold">🛡️ Protect what is left</div>
            {plan.protect.map((p) => <div key={p.code} className="text-xs">{p.emoji} {p.label}: {p.detail}. A ✗ cannot be undone this week, so no more of them. {p.atStake} points already gone.</div>)}
          </div>
        )}
        {plan.lost.length > 0 && <div className="text-xs muted">{plan.lost.map((p) => `${p.emoji} ${p.label}: ${p.detail}.`).join(" ")} Next week starts fresh.</div>}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="tile"><div className="muted">If you stop now</div><div className="font-bold text-base">{status.amount} EGP</div></div>
          <div className="tile"><div className="muted">If you do all of it</div><div className="font-bold text-base text-good">{Math.round(status.allowance * best.share)} EGP</div></div>
        </div>
      </section>

      {/* 4. Extra */}
      <section className="card space-y-2">
        <h2 className="h2">💪 Can I do extra?</h2>
        <ul className="text-sm space-y-2">
          <li className="flex gap-2"><span>🔁</span><span><b>Catch-ups count until pay day.</b> A missed class log, a missed check-in, yesterday&apos;s prayers and a skipped planned quiz can all still be filled in from Today or the Check-in, and they bring the points back in full.</span></li>
          {open.length > 0 && <li className="flex gap-2"><span>🪞</span><span><b>Earn-back.</b> Each consequence below has a task; do it and press &quot;I did it&quot;, a parent confirms.</span></li>}
          <li className="flex gap-2"><span>⭐</span><span><b>Extra quizzes and lessons earn points</b>, not extra allowance: the allowance is for the basics, and a clean week already pays all of it. Points go to Rewards.</span></li>
          {extras.length > 0 ? (
            <li className="flex gap-2"><span>🏆</span><span><b>Extra-effort rewards.</b> {extras.map((r) => `${r.emoji} ${r.title} needs ${r.requires_full_weeks} full-allowance week${r.requires_full_weeks === 1 ? "" : "s"} in a row`).join("; ")}. You are at {streakFull} in a row. <Link href="/rewards" className="underline">See them</Link>.</span></li>
          ) : (
            <li className="flex gap-2"><span>🏆</span><span><b>Full weeks in a row: {streakFull}.</b> Ask a parent about extra-effort rewards (like a weekend with a friend) that unlock after a streak of full weeks.</span></li>
          )}
        </ul>
      </section>

      <ConsequenceCard items={open} />

      {/* 5. Past weeks and claims */}
      <AllowanceClaims weeks={(closedWeeks ?? []) as ClosedWeek[]} />

      <details className="card text-xs muted">
        <summary className="cursor-pointer font-semibold text-ink">Every basic this week</summary>
        <ul className="mt-2 divide-y divide-line text-sm text-ink">
          {status.results.map((r) => (
            <li key={r.code} className="py-1.5 flex items-center gap-2">
              <span className="text-lg">{r.emoji}</span>
              <span className="flex-1">{r.label}<span className="muted text-xs"> · {r.detail}</span></span>
              <span className={`badge ${r.fraction >= 0.99 ? "text-good" : r.fraction >= 0.5 ? "text-warn" : "text-bad"}`}>{r.earned}/{r.weight}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2">Dish, manners and phone are judged by your parents once a day; only a ✗ costs you. Everything else the app counts by itself.</div>
      </details>
    </main>
  );
}
