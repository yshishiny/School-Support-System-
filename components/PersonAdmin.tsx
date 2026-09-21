"use client";

import { useActionState, useState } from "react";
import {
  disableUserAction, enableUserAction, resetPasswordAction,
  setAdminAction, setUserEmailAction, transferOwnershipAction,
} from "@/lib/actions/useradmin";
import type { Person } from "@/lib/accounts/people";

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
};

/**
 * One person, and everything that may be done to them.
 *
 * Which buttons appear is a hint, not the rule: the server asks `lib/accounts/rights` again on every call, so a
 * button that should not be here does nothing if it is. Hiding is for the reader's sake; refusing is for safety.
 */
export function PersonAdmin({ p, viewerIsAdmin, showFamily }: { p: Person; viewerIsAdmin: boolean; showFamily: boolean }) {
  const [open, setOpen] = useState<"none" | "password" | "email" | "disable">("none");
  const [pw, doReset, pwBusy] = useActionState(resetPasswordAction, undefined);
  const [mail, doEmail, mailBusy] = useActionState(setUserEmailAction, undefined);
  const [off, doDisable, offBusy] = useActionState(disableUserAction, undefined);
  const [on, doEnable, onBusy] = useActionState(enableUserAction, undefined);
  const [adm, doAdmin, admBusy] = useActionState(setAdminAction, undefined);
  const [own, doOwner, ownBusy] = useActionState(transferOwnershipAction, undefined);
  const says = [pw, mail, off, on, adm, own].find((s) => s?.error || s?.ok);

  return (
    <li className={`py-3 space-y-2 ${p.disabledAt ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none shrink-0">{p.avatarEmoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <b>{p.fullName}</b>
            <span className="text-xs muted">{p.role === "parent" ? "parent" : "child"}</span>
            {p.isFamilyOwner && <span className="badge text-[10px]">main parent</span>}
            {p.isAdmin && <span className="badge text-accent-2 text-[10px]">admin</span>}
            {p.disabledAt && <span className="badge text-bad text-[10px]">switched off</span>}
            {showFamily && <span className="text-xs muted">· {p.familyName}</span>}
          </div>
          <div className="text-xs muted">
            {p.placeholder ? <>username <b>{p.username}</b> · no real email</> : <>{p.email} · {p.verified ? "verified" : "not verified"}</>}
            {" · last signed in "}{ago(p.lastSignIn)}
          </div>
          {p.disabledAt && p.disabledReason && <div className="text-xs text-bad">Reason: {p.disabledReason}</div>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 pl-9">
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(open === "password" ? "none" : "password")}>Set password</button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(open === "email" ? "none" : "email")}>
          {p.placeholder ? "Add email" : "Change email"}
        </button>
        {p.disabledAt ? (
          <form action={doEnable}>
            <input type="hidden" name="user_id" value={p.id} />
            <button className="btn-ghost btn-sm" disabled={onBusy}>Switch back on</button>
          </form>
        ) : (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(open === "disable" ? "none" : "disable")}>Switch off</button>
        )}
        {p.role === "parent" && !p.isFamilyOwner && (
          <form action={doOwner}>
            <input type="hidden" name="user_id" value={p.id} />
            <button className="btn-ghost btn-sm" disabled={ownBusy}>Make main parent</button>
          </form>
        )}
        {viewerIsAdmin && p.role === "parent" && (
          <form action={doAdmin}>
            <input type="hidden" name="user_id" value={p.id} />
            <input type="hidden" name="grant" value={p.isAdmin ? "false" : "true"} />
            <button className="btn-ghost btn-sm" disabled={admBusy}>{p.isAdmin ? "Remove admin" : "Make admin"}</button>
          </form>
        )}
      </div>

      {open === "password" && (
        <form action={doReset} className="pl-9 grid sm:grid-cols-3 gap-2 items-end">
          <input type="hidden" name="user_id" value={p.id} />
          <div className="sm:col-span-1">
            <label className="label">New password</label>
            <input name="password" type="password" className="input py-1.5" minLength={8} required autoComplete="new-password" />
          </div>
          <div className="sm:col-span-1">
            <label className="label">Again</label>
            <input name="confirm" type="password" className="input py-1.5" minLength={8} required autoComplete="new-password" />
          </div>
          <button className="btn-primary btn-sm" disabled={pwBusy}>{pwBusy ? "Saving…" : "Set it"}</button>
        </form>
      )}

      {open === "email" && (
        <form action={doEmail} className="pl-9 flex flex-wrap items-end gap-2">
          <input type="hidden" name="user_id" value={p.id} />
          <div className="flex-1 min-w-[12rem]">
            <label className="label">Email address</label>
            <input name="email" type="email" className="input py-1.5" required placeholder="name@example.com" />
          </div>
          <button className="btn-primary btn-sm" disabled={mailBusy}>{mailBusy ? "Saving…" : "Set it"}</button>
        </form>
      )}

      {open === "disable" && (
        <form action={doDisable} className="pl-9 flex flex-wrap items-end gap-2">
          <input type="hidden" name="user_id" value={p.id} />
          <div className="flex-1 min-w-[12rem]">
            <label className="label">Why (they will be told)</label>
            <input name="reason" className="input py-1.5" placeholder="e.g. phone taken for the week" />
          </div>
          <button className="btn-primary btn-sm" disabled={offBusy}>{offBusy ? "…" : "Switch off"}</button>
        </form>
      )}

      {says?.error && <p className="pl-9 text-xs text-bad">{says.error}</p>}
      {says?.ok && <p className="pl-9 text-xs text-good">{says.ok}</p>}
    </li>
  );
}
