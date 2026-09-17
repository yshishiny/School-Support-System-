"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerFollowupAction } from "@/lib/actions/followups";
import { runAction } from "@/lib/client-action";
import { MIN_ANSWER_CHARS } from "@/lib/followups";

export function FollowupForm({ id }: { id: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setMsg(null);
          const r = await runAction(() => answerFollowupAction(id, text), setMsg);
          if (!r) return;
          if (r.error) setMsg(r.error);
          else router.refresh();
        });
      }}
    >
      <textarea className="input w-full min-h-[5rem]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Say what really happened, with the details. Nothing bad follows an honest answer." maxLength={1500} />
      <div className="flex items-center gap-2">
        <button className="btn-primary btn-sm" disabled={pending || text.trim().length < MIN_ANSWER_CHARS}>{pending ? "Sending…" : "Send answer"}</button>
        <span className="text-xs muted">{Math.max(0, MIN_ANSWER_CHARS - text.trim().length) ? `${Math.max(0, MIN_ANSWER_CHARS - text.trim().length)} more characters` : "+2 ★"}</span>
        {msg && <span className="text-xs text-bad">{msg}</span>}
      </div>
    </form>
  );
}
