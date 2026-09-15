"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepareNextPlannedQuizAction } from "@/lib/actions/plan";
import { Notice } from "./ui";

/** Fills a child's 7-day plan one quiz per request, showing progress, until nothing is missing. */
export function PreparePlanButton({ studentId, missing }: { studentId: string; missing: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  async function run() {
    setBusy(true);
    setError(null);
    let left = missing;
    let made = 0;
    try {
      while (left > 0) {
        setStatus(`Writing quiz ${made + 1} of ${missing}… about a minute each`);
        const r = await prepareNextPlannedQuizAction(studentId);
        if (r.error) {
          setError(r.error);
          break;
        }
        if (r.made) made += 1;
        setDone(made);
        if (r.remaining >= left && !r.made) break; // no progress: stop rather than spin
        left = r.remaining;
        router.refresh();
      }
      setStatus(left === 0 ? `Done: ${made} quiz${made === 1 ? "" : "zes"} ready for the week.` : null);
    } catch (err) {
      setError(`Could not continue (${err instanceof Error ? err.message : String(err)}). Reload and press again; finished quizzes are kept.`);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  if (missing === 0 && !status) return <span className="badge text-good">✓ Week is ready</span>;
  return (
    <div className="space-y-1">
      <button type="button" className="btn-primary btn-sm" onClick={run} disabled={busy || missing === 0}>
        {busy ? `Preparing… ${done}/${missing}` : `Prepare ${missing} missing quiz${missing === 1 ? "" : "zes"}`}
      </button>
      {status && <p className="text-xs muted">{status}</p>}
      <Notice error={error ?? undefined} />
    </div>
  );
}
