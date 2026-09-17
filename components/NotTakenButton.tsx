"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flagTopicNotTakenAction } from "@/lib/actions/learning";
import { runAction } from "@/lib/client-action";

/** On a quiz: "we have not taken this at school yet" → the plan skips the topic and the lesson opens. */
export function NotTakenButton({ topicId, topicName }: { topicId: string; topicName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="muted">Topic: {topicName}</span>
      <a href={`/learn/topic/${topicId}`} className="underline muted">📖 read the lesson first</a>
      <button type="button" disabled={pending} className="chip !py-0.5 text-[11px]" onClick={() => start(async () => { const r = await runAction(() => flagTopicNotTakenAction(topicId), setMsg); if (r === undefined) return; setMsg("Noted. This topic leaves your plan until your class log says you took it. Opening the lesson…"); router.push(`/learn/topic/${topicId}?explain=1`); })}>
        {pending ? "…" : "❓ We haven't taken this yet"}
      </button>
      {msg && <span className="muted">{msg}</span>}
    </div>
  );
}
