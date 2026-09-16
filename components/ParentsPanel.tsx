"use client";

import { useActionState, useState } from "react";
import { createInviteAction, revokeInviteAction, removeParentAction, saveCustodyPatternAction, setCustodyOverrideAction, updateParentProfileAction } from "@/lib/actions/family";
import { WEEKDAYS, parentName, type CustodyPattern, type ParentLite } from "@/lib/custody";
import { prettyDate } from "@/lib/dates";
import { Notice, SubmitButton } from "./ui";

export interface ParentRow extends ParentLite { telegram_chat_id: string | null; whatsapp: string | null; created_at: string }
export interface InviteRow { id: string; label: string | null; token: string; expires_at: string; used_at: string | null }
export interface OverrideRow { id: string; day: string; parent_id: string | null; note: string | null }

/** The parent's own card: label and WhatsApp number. Telegram is connected in its own box below. */
export function MyParentCard({ me }: { me: ParentRow }) {
  const [state, action] = useActionState(updateParentProfileAction, undefined);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="h2">You</h2>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Your name</label><input name="full_name" className="input" defaultValue={me.full_name} /></div>
        <div><label className="label">The kids call you</label><input name="parent_label" className="input" placeholder="Dad, Mum, Baba…" defaultValue={me.parent_label ?? ""} /></div>
      </div>
      <div>
        <label className="label">Your WhatsApp number (country code, digits only)</label>
        <input name="whatsapp" className="input" inputMode="numeric" placeholder="2010xxxxxxxx" defaultValue={me.whatsapp ?? ""} />
      </div>
      <Notice error={state?.error} ok={state?.ok} />
      <SubmitButton pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}

/** Co-parents: who is in the family, invite links, and custody days. */
export function ParentsPanel({ me, parents, invites, pattern, overrides, today, baseUrl }: { me: string; parents: ParentRow[]; invites: InviteRow[]; pattern: CustodyPattern; overrides: OverrideRow[]; today: string; baseUrl: string }) {
  const [inviteState, inviteAction] = useActionState(createInviteAction, undefined);
  const [copied, setCopied] = useState<string | null>(null);
  const openInvites = invites.filter((i) => !i.used_at && new Date(i.expires_at) > new Date());
  const link = (t: string) => `${baseUrl}/join/${t}`;
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(null), 2000); } catch { /* no clipboard */ }
  }
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="h2">Parents</h2>
        <p className="text-xs muted">Every parent has their own login and their own Telegram. Both always get the daily report and any safety alert. Custody days decide who is asked the daily taps.</p>
      </div>
      <ul className="divide-y divide-line text-sm">
        {parents.map((p) => (
          <li key={p.id} className="py-2 flex items-center gap-2">
            <span className="text-xl">👤</span>
            <span className="flex-1 min-w-0">
              <b>{p.full_name}</b>{p.parent_label ? <span className="muted"> · {p.parent_label}</span> : null}{p.id === me ? <span className="badge ml-1">you</span> : null}
              <div className="text-xs muted">{p.telegram_chat_id ? "Telegram connected" : "No Telegram yet"}{p.whatsapp ? ` · WhatsApp +${p.whatsapp}` : ""}</div>
            </span>
            {p.id !== me && (
              <form action={removeParentAction.bind(null, p.id)} onSubmit={(e) => { if (!confirm(`Remove ${p.full_name}'s login from the family?`)) e.preventDefault(); }}>
                <button className="btn-ghost btn-sm">Remove</button>
              </form>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <div className="label">Invite the other parent</div>
        <form action={inviteAction} className="flex gap-2">
          <input name="label" className="input flex-1" placeholder="Mum, Dad… (optional)" />
          <SubmitButton className="btn-primary" pendingText="Creating…">Create link</SubmitButton>
        </form>
        <Notice error={inviteState?.error} />
        {[...(inviteState?.link ? [{ id: "new", token: inviteState.link.split("/join/")[1] ?? "", label: null, expires_at: new Date(Date.now() + 14 * 86400000).toISOString(), used_at: null }] : []), ...openInvites.filter((i) => !inviteState?.link || !inviteState.link.endsWith(i.token))].map((i) => (
          <div key={i.id} className="tile !p-2 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate">{i.label ? `For ${i.label} · ` : ""}valid until {prettyDate(i.expires_at.slice(0, 10))}</span>
              <button type="button" className="btn-ghost btn-sm" onClick={() => copy(link(i.token))}>{copied === link(i.token) ? "Copied ✓" : "Copy link"}</button>
              <a className="btn-ghost btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`Join our kids' study portal as a parent: ${link(i.token)} (valid 14 days)`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
              {i.id !== "new" && <form action={revokeInviteAction.bind(null, i.id)}><button className="btn-ghost btn-sm">✕</button></form>}
            </div>
            <div className="font-mono break-all muted">{link(i.token)}</div>
          </div>
        ))}
      </div>

      {parents.length > 1 && (
        <form action={saveCustodyPatternAction} className="space-y-2">
          <div className="label">Custody days · who has the kids on each day</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WEEKDAYS.map((d, k) => (
              <label key={d} className="text-xs space-y-1">
                <span className="font-semibold">{d}</span>
                <select name={`day_${k}`} className="input !py-1" defaultValue={pattern[String(k)] ?? ""}>
                  <option value="">Both / shared</option>
                  {parents.map((p) => <option key={p.id} value={p.id}>{parentName(p)}</option>)}
                </select>
              </label>
            ))}
          </div>
          <SubmitButton className="btn-ghost btn-sm" pendingText="Saving…">Save custody days</SubmitButton>
        </form>
      )}

      {parents.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer muted text-xs">One-off changes (holidays, swaps)</summary>
          <form action={setCustodyOverrideAction} className="mt-2 grid grid-cols-2 gap-2 items-end">
            <div><label className="label">Date</label><input name="day" type="date" className="input" defaultValue={today} required /></div>
            <div><label className="label">With</label>
              <select name="parent_id" className="input"><option value="">Both / shared</option>{parents.map((p) => <option key={p.id} value={p.id}>{parentName(p)}</option>)}</select>
            </div>
            <div className="col-span-2"><input name="note" className="input" placeholder="Note (optional)" /></div>
            <div className="col-span-2"><SubmitButton className="btn-ghost btn-sm" pendingText="Saving…">Save this date</SubmitButton></div>
          </form>
          {overrides.length > 0 && (
            <ul className="mt-2 divide-y divide-line text-xs">
              {overrides.map((o) => (
                <li key={o.id} className="py-1.5 flex items-center gap-2">
                  <span className="flex-1">{prettyDate(o.day)} · with {parentName(parents.find((p) => p.id === o.parent_id))}{o.note ? ` · ${o.note}` : ""}</span>
                  <form action={setCustodyOverrideAction}><input type="hidden" name="day" value={o.day} /><input type="hidden" name="remove" value="1" /><button className="btn-ghost btn-sm">✕</button></form>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </section>
  );
}
