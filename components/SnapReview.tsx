"use client";

import { useState, useTransition } from "react";
import { reviewSnapAction } from "@/lib/actions/snaps";
import { runAction } from "@/lib/client-action";

/** Parent's one tap per snap: approve or send back with a short note. */
export function SnapReview({ snapId }: { snapId: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [sendBack, setSendBack] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} className="btn-primary btn-sm" onClick={() => start(async () => { await runAction(() => reviewSnapAction(snapId, "approved"), setMsg); })}>✓ Approve</button>
      {!sendBack ? (
        <button type="button" disabled={pending} className="btn-ghost btn-sm" onClick={() => setSendBack(true)}>✗ Send back</button>
      ) : (
        <>
          <input className="input !py-1 text-xs flex-1 min-w-[10rem]" placeholder="Why (he sees this)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          <button type="button" disabled={pending} className="btn-ghost btn-sm text-bad" onClick={() => start(async () => { await runAction(() => reviewSnapAction(snapId, "rejected", note), setMsg); })}>Send back</button>
        </>
      )}
      {msg && <span className="text-xs muted">{msg}</span>}
    </div>
  );
}
