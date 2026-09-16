"use client";

import { useState, useTransition } from "react";
import { reviewSnapAction } from "@/lib/actions/snaps";

/** Parent's one tap per snap: approve or send back with a short note. */
export function SnapReview({ snapId }: { snapId: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [sendBack, setSendBack] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} className="btn-primary btn-sm" onClick={() => start(async () => { await reviewSnapAction(snapId, "approved"); })}>✓ Approve</button>
      {!sendBack ? (
        <button type="button" disabled={pending} className="btn-ghost btn-sm" onClick={() => setSendBack(true)}>✗ Send back</button>
      ) : (
        <>
          <input className="input !py-1 text-xs flex-1 min-w-[10rem]" placeholder="Why (he sees this)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          <button type="button" disabled={pending} className="btn-ghost btn-sm text-bad" onClick={() => start(async () => { await reviewSnapAction(snapId, "rejected", note); })}>Send back</button>
        </>
      )}
    </div>
  );
}
