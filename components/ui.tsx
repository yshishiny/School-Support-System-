"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn-primary", pendingText = "Saving…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

export function Notice({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p className="rounded-xl bg-bad/15 border border-bad/40 text-bad px-3 py-2 text-sm">{error}</p>;
  if (ok) return <p className="rounded-xl bg-good/15 border border-good/40 text-good px-3 py-2 text-sm">{ok}</p>;
  return null;
}
