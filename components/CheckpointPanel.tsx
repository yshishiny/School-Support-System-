"use client";

import { useActionState } from "react";
import { requestSpotCheckAction } from "@/lib/actions/checkpoint";
import type { CheckpointResult } from "@/lib/checkpoint";
import { Notice, SubmitButton } from "./ui";

export interface CheckpointRow { id: string; kind: string; subject: string | null; status: string; due_by: string; week_start: string; result: CheckpointResult | null; error: string | null; created_at: string }

const ICON: Record<string, string> = { strong: "🟢", ok: "🟡", weak: "🔴", unmeasured: "⚪" };

/** Parent view of a child's checkpoints: positions per subject, claim vs. score, and a spot check on demand. */
export function CheckpointPanel({ studentId, firstName, rows, subjects }: { studentId: string; firstName: string; rows: CheckpointRow[]; subjects: string[] }) {
  const [state, action] = useActionState(requestSpotCheckAction, undefined);
  const latest = rows[0] ?? null;
  return (
    <div className="rounded-xl border border-line p-3 text-sm space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🎯</span>
        <div className="flex-1">
          <div className="font-semibold">Checkpoints <span className="muted font-normal">· timed, one attempt, built from what he logged</span></div>
          <div className="muted text-xs">Weekly on the day before pay day. A subject logged in the class log but failed here is flagged: claimed, not learned.</div>
        </div>
      </div>
      {latest ? (
        <div className="space-y-1">
          {rows.slice(0, 3).map((r) => (
            <div key={r.id} className="text-xs">
              <b>{r.kind === "weekly" ? "Weekly" : `Spot · ${r.subject ?? "week"}`}</b> · {r.status === "done" && r.result ? (
                <>
                  {r.result.score}/{r.result.total}
                  <ul className="pl-3 mt-0.5 space-y-0.5">
                    {r.result.bySubject.map((s) => (
                      <li key={s.subject}>{ICON[s.position]} {s.subject}: {s.correct}/{s.total}{s.verdict === "claimed_not_learned" ? <span className="text-bad"> · logged {s.claimed} lesson{s.claimed === 1 ? "" : "s"}, not learned</span> : s.verdict === "not_claimed" ? <span className="muted"> · not in his class log</span> : s.claimed ? <span className="muted"> · {s.claimed} lesson{s.claimed === 1 ? "" : "s"} logged</span> : null}</li>
                    ))}
                  </ul>
                </>
              ) : r.status === "ready" ? <span className="text-warn">ready, not attempted (by {r.due_by})</span> : r.status === "expired" ? <span className="text-bad">not attempted before the week closed</span> : <span className="muted">could not be prepared{r.error ? `: ${r.error}` : ""}</span>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs muted">None yet. The first weekly one is built automatically once he has logged a few classes.</p>
      )}
      <form action={action} className="flex flex-wrap items-center gap-2 pt-1">
        <input type="hidden" name="student_id" value={studentId} />
        <select name="subject" className="input !py-1 !w-auto text-xs">
          <option value="">Whole week</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <SubmitButton className="btn-ghost btn-sm" pendingText="Building… (up to a minute)">⚡ Spot check {firstName} now</SubmitButton>
        <Notice error={state?.error} ok={state?.ok} />
      </form>
    </div>
  );
}
