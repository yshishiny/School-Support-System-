"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction } from "@/lib/actions/auth";
import { Notice, SubmitButton } from "./ui";

export function JoinForm({ token, label }: { token: string; label: string | null }) {
  const [state, action] = useActionState(signupAction, undefined);
  if (state?.done) {
    return (
      <div className="card space-y-2">
        <p className="h2">Check your email</p>
        <p className="muted text-sm">We sent a confirmation link. Open it, then sign in.</p>
        <Link href="/login" className="btn-ghost w-full">Back to sign in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="invite_token" value={token} />
      <div>
        <label className="label">Your name</label>
        <input name="full_name" className="input" required />
      </div>
      <div>
        <label className="label">What the kids call you (shown in reports)</label>
        <input name="parent_label" className="input" placeholder="Mum, Dad, Mama…" defaultValue={label ?? ""} />
      </div>
      <div>
        <label className="label">Email</label>
        <input name="email" type="email" className="input" required />
      </div>
      <div>
        <label className="label">Password (8+ characters)</label>
        <input name="password" type="password" className="input" minLength={8} required />
      </div>
      <Notice error={state?.error} />
      <SubmitButton className="btn-primary w-full" pendingText="Joining…">Join the family</SubmitButton>
      <p className="text-center text-sm muted">Already have a login? <Link href="/login" className="text-accent-2">Sign in</Link></p>
    </form>
  );
}
