"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buyAccessAction, createInviteAction, grantCreditsAction, redeemInviteAction } from "@/lib/actions/access";

/** One plan's buy button, with the child picker only where a plan is for one child. */
export function BuyAccess({ planId, scope, credits, balance, students }: {
  planId: string;
  scope: "child" | "family";
  credits: number;
  balance: number;
  students: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const short = balance < credits;

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      action={(fd) => start(async () => {
        setMsg(null); setErr(null);
        const r = await buyAccessAction(fd);
        if (r.error) { setErr(r.error); return; }
        setMsg(r.ok ?? null);
        router.refresh();
      })}
    >
      <input type="hidden" name="plan" value={planId} />
      {scope === "child" && (
        <select name="student_id" className="input flex-1 min-w-32 !py-2" aria-label="Which child">
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          {students.length === 0 && <option value="">No children yet</option>}
        </select>
      )}
      <button className="btn-primary btn-sm min-h-11" disabled={pending || short || (scope === "child" && students.length === 0)}>
        {pending ? "…" : short ? `Need ${(credits - balance).toLocaleString()} more` : "Use credits"}
      </button>
      {err && <span className="text-xs text-bad">{err}</span>}
      {msg && <span className="text-xs text-good">{msg}</span>}
    </form>
  );
}

/** The two invite links, and the box for a code somebody sent you. */
export function InviteBox({ invites, left }: { invites: { id: string; code: string; label: string | null; accepted: boolean; rewarded: boolean }[]; left: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const linkFor = (code: string) => (typeof window === "undefined" ? `/join?invite=${code}` : `${window.location.origin}/join?invite=${code}`);
  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(linkFor(code)); setCopied(code); } catch { setCopied(null); }
  };

  return (
    <div className="space-y-3">
      {invites.length > 0 && (
        <ul className="space-y-2">
          {invites.map((i) => (
            <li key={i.id} className="tile !p-2 space-y-1">
              <div className="flex items-center gap-2">
                <code className="font-mono text-lg font-bold tracking-widest">{i.code}</code>
                <span className="flex-1 min-w-0 truncate text-xs muted">{i.label ?? "no name"}</span>
                {i.accepted ? <span className="badge text-good">used</span> : <span className="badge muted">waiting</span>}
              </div>
              {!i.accepted && (
                <button type="button" className="btn-ghost btn-sm min-h-9 w-full" onClick={() => copy(i.code)}>
                  {copied === i.code ? "Link copied ✓" : "Copy the invite link"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {left > 0 && (
        <form
          className="flex flex-wrap gap-2"
          action={(fd) => start(async () => {
            setMsg(null); setErr(null);
            const r = await createInviteAction(fd);
            if (r.error) { setErr(r.error); return; }
            setMsg(r.ok ?? null);
            router.refresh();
          })}
        >
          <input name="label" className="input flex-1 min-w-32 !py-2" placeholder="Who is it for? (their family name)" maxLength={60} aria-label="Who the invite is for" />
          <button className="btn-ghost btn-sm min-h-11" disabled={pending}>{pending ? "…" : `Make an invite (${left} left)`}</button>
        </form>
      )}

      <form
        className="flex flex-wrap gap-2 border-t border-line pt-3"
        action={(fd) => start(async () => {
          setMsg(null); setErr(null);
          const r = await redeemInviteAction(fd);
          if (r.error) { setErr(r.error); return; }
          setMsg(r.ok ?? null);
          router.refresh();
        })}
      >
        <input name="code" className="input flex-1 min-w-32 !py-2 font-mono tracking-widest" placeholder="Were you invited? Code here" maxLength={12} aria-label="Invite code" />
        <button className="btn-ghost btn-sm min-h-11" disabled={pending}>{pending ? "…" : "Use it"}</button>
      </form>

      {err && <p className="text-xs text-bad">{err}</p>}
      {msg && <p className="text-xs text-good">{msg}</p>}
    </div>
  );
}

/** Owner only: hand a family credits. */
export function GrantCredits({ families }: { families: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      action={(fd) => start(async () => {
        const r = await grantCreditsAction(fd);
        setMsg(r.error ?? r.ok ?? null);
        router.refresh();
      })}
    >
      <select name="family_id" className="input flex-1 min-w-40 !py-2" aria-label="Which family">
        {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      <input name="credits" type="number" className="input w-28 text-center !py-2" placeholder="credits" aria-label="How many credits" />
      <input name="reason" className="input flex-1 min-w-32 !py-2" placeholder="What for" maxLength={120} aria-label="Reason" />
      <button className="btn-primary btn-sm min-h-11" disabled={pending}>{pending ? "…" : "Give"}</button>
      {msg && <span className="text-xs muted">{msg}</span>}
    </form>
  );
}
