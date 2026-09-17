"use client";

import { useState, useTransition } from "react";
import { startLessonAction } from "@/lib/actions/teach";
import { runAction } from "@/lib/client-action";

export function StartLessonButton({ topicId, materialId, label = "▶ Teach me", className = "btn-primary btn-sm" }: { topicId?: string; materialId?: string; label?: string; className?: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" disabled={pending} className={className} onClick={() => start(async () => { setErr(null); const r = await runAction(() => startLessonAction({ topicId, materialId }), setErr); if (r?.error) setErr(r.error); })}>{pending ? "Preparing the lesson… (first time takes a minute)" : label}</button>
      {err && <span className="text-[11px] text-bad">{err}</span>}
    </span>
  );
}
