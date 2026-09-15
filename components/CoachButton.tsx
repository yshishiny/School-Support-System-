"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateCoachReportAction } from "@/lib/actions/coach";
import { Notice } from "./ui";

export function CoachButton({ studentId, hasReport }: { studentId: string; hasReport: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <button
        type="button"
        className={hasReport ? "btn-ghost btn-sm" : "btn-primary btn-sm"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const r = await generateCoachReportAction(studentId);
              if (r.error) setError(r.error);
              router.refresh();
            } catch (err) {
              setError(`Could not run (${err instanceof Error ? err.message : String(err)}). Reload and try again.`);
            }
          })
        }
      >
        {pending ? "Analysing… about a minute" : hasReport ? "Refresh analysis" : "🦸 Run the coach"}
      </button>
      <Notice error={error ?? undefined} />
    </div>
  );
}
