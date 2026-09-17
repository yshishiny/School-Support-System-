"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildRevisionNowAction } from "@/lib/actions/revision";
import { runAction } from "@/lib/client-action";

export function RevisionButton({ studentId, label = "Build this month's revision now" }: { studentId: string | null; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <button type="button" disabled={pending} className="btn-primary btn-sm" onClick={() => start(async () => { setMsg(null); const r = await runAction(() => buildRevisionNowAction(studentId), setMsg); if (!r) return; setMsg(r.error ?? r.lines?.join(" · ") ?? null); router.refresh(); })}>{pending ? "Writing sheets and quizzes… up to 4 minutes" : label}</button>
      {msg && <p className="text-xs muted">{msg}</p>}
    </div>
  );
}
