import { LoginForm } from "@/components/AuthForms";

/** A person bounced back here deserves to know why rather than wondering if they mistyped. */
const REASONS: Record<string, string> = {
  disabled: "That account has been switched off. Ask the parent who looks after it to turn it back on.",
  no_profile: "That sign-in worked but the account has no profile yet. Ask a parent to finish setting it up.",
  no_family: "That account is not attached to a family yet.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const reason = error ? REASONS[error] : null;
  return (
    <main className="mx-auto max-w-sm px-4 py-12 space-y-6">
      <div className="text-center space-y-1">
        <div className="text-5xl">📚</div>
        <h1 className="h1">Study Portal</h1>
        <p className="muted text-sm">Check in daily. Level up. Earn rewards.</p>
      </div>
      {reason && <p className="card text-sm border-warn/60">{reason}</p>}
      <LoginForm />
    </main>
  );
}
