"use client";

import { useState, useTransition } from "react";
import { sendReportNowAction } from "@/lib/actions/reports";
import { Notice } from "./ui";

export function SendReportButton({ lastStatus }: { lastStatus: string | null }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; ok?: string } | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-primary w-full"
        disabled={pending}
        onClick={() => {
          setResult(null);
          start(async () => {
            try {
              setResult(await sendReportNowAction(undefined));
            } catch (err) {
              setResult({ error: `Could not reach the server: ${err instanceof Error ? err.message : String(err)}. Reload the page and try again.` });
            }
          });
        }}
      >
        {pending ? "Generating and sending… (up to 30s)" : "📨 Send today's report now"}
      </button>
      <Notice error={result?.error} ok={result?.ok} />
      {!result && lastStatus && <p className="text-xs muted">Last attempt: {lastStatus}</p>}
    </div>
  );
}
