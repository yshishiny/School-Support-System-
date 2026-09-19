"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustWalletAction, claimExpenseAction, decideClaimAction, handOverAction, spendAction } from "@/lib/actions/wallet";
import { CLAIM_PURPOSES, SPEND_CATEGORIES } from "@/lib/wallet";

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


/**
 * "Pay me back." A child may only claim money he spent on the family or on school, and only by saying what it was
 * for, why, and whether he asked first. The form says all three out loud, so the honesty is part of the asking.
 */
export function ClaimForm({ entryId, label, amount }: { entryId: string; label: string; amount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return <button type="button" className="btn-ghost btn-sm min-h-9" onClick={() => setOpen(true)}>Ask to be paid back</button>;
  }
  return (
    <form
      className="mt-2 space-y-2 rounded-xl bg-panel-2/60 p-2"
      action={(fd) => start(async () => {
        setMsg(null); setErr(null);
        const r = await claimExpenseAction(fd);
        if (r.error) { setErr(r.error); return; }
        setMsg(r.ok ?? null);
        setOpen(false);
        router.refresh();
      })}
    >
      <input type="hidden" name="id" value={entryId} />
      <p className="text-xs muted">Claiming back {amount} EGP for “{label}”. Only things for the family or for school count; anything you bought for yourself does not.</p>
      <div className="grid grid-cols-2 gap-1.5">
        {CLAIM_PURPOSES.map((p, k) => (
          <label key={p.id} className="flex cursor-pointer items-start gap-1.5 rounded-xl border border-line p-2 text-xs has-[:checked]:border-accent has-[:checked]:bg-accent/15">
            <input type="radio" name="purpose" value={p.id} defaultChecked={k === 0} className="mt-0.5" />
            <span><b>{p.emoji} {p.label}</b><br /><span className="muted">{p.hint}</span></span>
          </label>
        ))}
      </div>
      <textarea name="reason" rows={2} maxLength={300} className="input text-sm" placeholder="Why did you spend it, and why should it be paid back?" />
      <fieldset className="flex items-center gap-3 text-xs">
        <legend className="sr-only">Did you ask permission first?</legend>
        <span className="muted">Did you ask first?</span>
        <label className="flex items-center gap-1"><input type="radio" name="asked" value="yes" /> Yes</label>
        <label className="flex items-center gap-1"><input type="radio" name="asked" value="no" /> No</label>
      </fieldset>
      <div className="flex gap-2">
        <button className="btn-primary btn-sm min-h-10 flex-1" disabled={pending}>{pending ? "…" : "Send it to Dad"}</button>
        <button type="button" className="btn-ghost btn-sm min-h-10" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {err && <p className="text-xs text-bad">{err}</p>}
      {msg && <p className="text-xs text-good">{msg}</p>}
    </form>
  );
}

/** The parent's one tap on a claim, with a note the child sees. */
export function ClaimDecision({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const decide = (decision: "approved" | "rejected") =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", entryId);
      fd.set("decision", decision);
      fd.set("note", note);
      const r = await decideClaimAction(fd);
      setMsg(r.error ?? r.ok ?? null);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} className="btn-primary btn-sm min-h-10" onClick={() => decide("approved")}>✓ Pay it back</button>
      <input className="input !py-1 min-w-[9rem] flex-1 text-xs" placeholder="A word back to him" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      <button type="button" disabled={pending} className="btn-ghost btn-sm min-h-10 !text-bad" onClick={() => decide("rejected")}>✗ No</button>
      {msg && <span className="text-xs muted">{msg}</span>}
    </div>
  );
}
