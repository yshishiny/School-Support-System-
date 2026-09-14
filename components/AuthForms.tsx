"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, signupAction } from "@/lib/actions/auth";
import { Notice, SubmitButton } from "./ui";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label">Username or email</label>
        <input name="login" className="input" autoCapitalize="none" autoComplete="username" required />
      </div>
      <div>
        <label className="label">Password</label>
        <input name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      <Notice error={state?.error} />
      <SubmitButton className="btn-primary w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm muted">
        Parent without an account? <Link href="/signup" className="text-accent-2">Create the family</Link>
      </p>
    </form>
  );
}

export function SignupForm() {
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
      <div>
        <label className="label">Your name</label>
        <input name="full_name" className="input" required />
      </div>
      <div>
        <label className="label">Family name</label>
        <input name="family_name" className="input" placeholder="e.g. Shishiny family" />
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
      <SubmitButton className="btn-primary w-full" pendingText="Creating…">
        Create parent account
      </SubmitButton>
      <p className="text-center text-sm muted">
        Already have one? <Link href="/login" className="text-accent-2">Sign in</Link>
      </p>
    </form>
  );
}
