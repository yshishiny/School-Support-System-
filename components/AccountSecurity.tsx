"use client";

import { useActionState, useState, useTransition } from "react";
import { changeMyEmailAction, changeMyPasswordAction, resendMyVerificationAction } from "@/lib/actions/account";

export interface AccountSecurityProps {
  firstName: string;
  /** The address on the account now — for a child this is usually the stand-in one the app invented. */
  email: string | null;
  /** An address that has been asked for but not yet proven. */
  pendingEmail: string | null;
  verified: boolean;
  placeholder: boolean;
  /** What a child types to sign in, when the address is not a real one. */
  username: string | null;
}

/**
 * One panel, used by a parent and by a child, because the two need exactly the same three things.
 *
 * It asks for the current password to change the password. That is not ceremony: the session only proves this
 * browser was left signed in, and in a house where a laptop is shared that is not the same as proving who is
 * typing. Everything here acts on the signed-in account and nobody else's — administering another person's
 * account is a different screen with different rules.
 */
export function AccountSecurity({ firstName, email, pendingEmail, verified, placeholder, username }: AccountSecurityProps) {
  const [pw, changePw, pwBusy] = useActionState(changeMyPasswordAction, undefined);
  const [mail, changeMail, mailBusy] = useActionState(changeMyEmailAction, undefined);
  const [resent, setResent] = useState<string | null>(null);
  const [resending, startResend] = useTransition();
  const [openPw, setOpenPw] = useState(false);
  const [openMail, setOpenMail] = useState(false);

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="h2">🔐 Your account</h2>
        <p className="text-xs muted">Only you can change these, and only for yourself.</p>
      </div>

      {/* ── How you sign in ───────────────────────────────────────────────── */}
      <div className="text-sm space-y-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="muted text-xs">Signs in with</span>
          <b>{placeholder && username ? username : email ?? "—"}</b>
          {placeholder ? (
            <span className="badge muted text-[10px]">username</span>
          ) : verified ? (
            <span className="badge text-good text-[10px]">verified</span>
          ) : (
            <span className="badge text-warn text-[10px]">not verified</span>
          )}
        </div>
        {placeholder && (
          <p className="text-xs muted">
            {firstName} has no real email yet, so there is no way to reset a forgotten password without a parent.
            Adding one fixes that.
          </p>
        )}
        {pendingEmail && (
          <p className="text-xs text-warn">
            Waiting on <b>{pendingEmail}</b> — open the link in that inbox. The current address keeps working until you do.
          </p>
        )}
      </div>

      {/* ── Password ──────────────────────────────────────────────────────── */}
      <div className="border-t border-line pt-2.5">
        {!openPw ? (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setOpenPw(true)}>Change password</button>
        ) : (
          <form action={changePw} className="space-y-2">
            <div>
              <label className="label" htmlFor="current_password">Your current password</label>
              <input id="current_password" name="current_password" type="password" className="input" autoComplete="current-password" required />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="new_password">New password</label>
                <input id="new_password" name="new_password" type="password" className="input" autoComplete="new-password" minLength={8} required />
              </div>
              <div>
                <label className="label" htmlFor="confirm_password">Again</label>
                <input id="confirm_password" name="confirm_password" type="password" className="input" autoComplete="new-password" minLength={8} required />
              </div>
            </div>
            <p className="text-xs muted">At least 8 characters. Something you will remember without writing it down.</p>
            <div className="flex items-center gap-2">
              <button className="btn-primary btn-sm" disabled={pwBusy}>{pwBusy ? "Saving…" : "Save password"}</button>
              <button type="button" className="text-xs muted" onClick={() => setOpenPw(false)}>cancel</button>
            </div>
          </form>
        )}
        {pw?.error && <p className="text-xs text-bad mt-1">{pw.error}</p>}
        {pw?.ok && <p className="text-xs text-good mt-1">{pw.ok}</p>}
      </div>

      {/* ── Email ─────────────────────────────────────────────────────────── */}
      <div className="border-t border-line pt-2.5 space-y-2">
        {!openMail ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setOpenMail(true)}>
              {placeholder ? "Add an email address" : "Change email"}
            </button>
            {!placeholder && !verified && (
              <button
                type="button" className="btn-ghost btn-sm" disabled={resending}
                onClick={() => startResend(async () => {
                  const r = await resendMyVerificationAction();
                  setResent(r.error ?? r.ok ?? null);
                })}
              >
                {resending ? "Sending…" : "Send the link again"}
              </button>
            )}
          </div>
        ) : (
          <form action={changeMail} className="space-y-2">
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" className="input" autoComplete="email" required placeholder="name@example.com" />
            </div>
            <p className="text-xs muted">A link goes to that inbox. Nothing changes until it is opened.</p>
            <div className="flex items-center gap-2">
              <button className="btn-primary btn-sm" disabled={mailBusy}>{mailBusy ? "Sending…" : "Send the link"}</button>
              <button type="button" className="text-xs muted" onClick={() => setOpenMail(false)}>cancel</button>
            </div>
          </form>
        )}
        {mail?.error && <p className="text-xs text-bad">{mail.error}</p>}
        {mail?.ok && <p className="text-xs text-good">{mail.ok}</p>}
        {resent && <p className="text-xs muted">{resent}</p>}
      </div>
    </section>
  );
}
