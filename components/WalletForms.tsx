"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustWalletAction, handOverAction, spendAction } from "@/lib/actions/wallet";
import { SPEND_CATEGORIES } from "@/lib/wallet";

/** The child writes down one thing he bought. */
export function SpendForm({ today }: { today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      action={(fd) => start(async () => {
        setMsg(null); setErr(null);
        const r = await spendAction(fd);
        if (r.error) { setErr(r.error); return; }
        setMsg(r.ok ?? null);
        router.refresh();
      })}
    >
      <div className="flex gap-2">
        <input name="amount" inputMode="decimal" className="input w-24 shrink-0 text-center" placeholder="EGP" aria-label="How much" />
        <input name="label" className="input flex-1" placeholder="What did you buy?" maxLength={80} aria-label="What did you buy" />
      </div>
      <div className="flex gap-2">
        <select name="category" className="input flex-1" aria-label="What kind of thing">
          {SPEND_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
        <input name="on" type="date" defaultValue={today} max={today} className="input w-40" aria-label="When" />
      </div>
      <button className="btn-primary w-full min-h-12" disabled={pending}>{pending ? "…" : "Write it down"}</button>
      {err && <p className="text-xs text-bad">{err}</p>}
      {msg && <p className="text-xs text-good">{msg}</p>}
    </form>
  );
}

/** The parent hands cash over, or adds money by hand. */
export function ParentWalletForms({ studentId, name, today }: { studentId: string; name: string; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: (fd: FormData) => Promise<{ error?: string; ok?: string }>) => (fd: FormData) =>
    start(async () => {
      setMsg(null); setErr(null);
      const r = await fn(fd);
      if (r.error) { setErr(r.error); return; }
      setMsg(r.ok ?? null);
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <form className="flex flex-wrap items-center gap-2 text-sm" action={run(handOverAction)}>
        <input type="hidden" name="student_id" value={studentId} />
        <span className="w-20 shrink-0 font-semibold">{name}</span>
        <input name="amount" inputMode="decimal" className="input w-24 text-center" placeholder="EGP" aria-label={`How much handed to ${name}`} />
        <input name="on" type="date" defaultValue={today} max={today} className="input w-36" aria-label="When" />
        <button className="btn-ghost btn-sm min-h-10" disabled={pending} title="Money you gave him in cash: it leaves what you hold and becomes his pocket money">{pending ? "…" : "Handed over 🤝"}</button>
      </form>
      <form className="flex flex-wrap items-center gap-2 text-sm" action={run(adjustWalletAction)}>
        <input type="hidden" name="student_id" value={studentId} />
        <span className="w-20 shrink-0 text-xs muted">add money</span>
        <input name="amount" inputMode="decimal" className="input w-24 text-center" placeholder="EGP" aria-label={`Add money for ${name}`} />
        <input name="label" className="input flex-1 min-w-32" placeholder="What for? (Eid, a job, a gift)" maxLength={80} aria-label="What for" />
        <button className="btn-ghost btn-sm min-h-10" disabled={pending}>{pending ? "…" : "Add"}</button>
      </form>
      {err && <p className="text-xs text-bad">{err}</p>}
      {msg && <p className="text-xs text-good">{msg}</p>}
    </div>
  );
}
