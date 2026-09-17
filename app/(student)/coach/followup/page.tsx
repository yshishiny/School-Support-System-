import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { todayIn, prettyDate } from "@/lib/dates";
import { ensureFollowups } from "@/lib/followups/run";
import { FollowupForm } from "@/components/FollowupForm";

/** "A few questions from your coach": one thread per thing the app noticed, asked again on later days. */
export default async function FollowupPage() {
  const { profile, family } = await requireStudent();
  const today = todayIn(family.timezone);
  const rows = await ensureFollowups(profile.id, family.id, today, family.timezone, family.allowance_pay_weekday);
  const open = rows.filter((r) => !r.answer);
  const answered = rows.filter((r) => r.answer);
  return (
    <main className="space-y-4">
      <header className="flex items-center gap-3">
        <span className="text-4xl sticker-still">🗣️</span>
        <div className="flex-1">
          <h1 className="h1">Straight answers</h1>
          <p className="text-sm muted">Your coach noticed a few things and wants the story from you. Same question may come back another day, asked differently; that is normal. Honest and detailed is all that counts.</p>
        </div>
        <Link href="/today" className="btn-ghost btn-sm">Today</Link>
      </header>

      {open.length === 0 && <p className="card text-sm muted">Nothing to answer right now. 👍</p>}
      {open.map((r) => (
        <section key={r.id} className="card space-y-2 border-accent/50">
          <div className="text-xs muted">Round {r.round} of 3 · {r.signal_label}</div>
          <p className="font-semibold">{r.question}</p>
          <FollowupForm id={r.id} />
        </section>
      ))}

      {answered.length > 0 && (
        <details className="card text-sm">
          <summary className="cursor-pointer muted">What you answered this week ({answered.length})</summary>
          <ul className="mt-2 space-y-2">
            {answered.map((r) => (
              <li key={r.id} className="tile space-y-0.5">
                <div className="text-xs muted">{prettyDate(r.asked_on)} · round {r.round} · {r.signal_label}</div>
                <div className="text-xs">{r.question}</div>
                <div className="font-semibold">“{r.answer}”</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
