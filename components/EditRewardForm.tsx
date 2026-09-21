"use client";

import { useActionState, useState } from "react";
import { updateRewardAction } from "@/lib/actions/rewards";
import { mismatchLine } from "@/lib/rewards/money";

export interface EditableReward {
  id: string;
  title: string;
  emoji: string;
  kind: string;
  cost_points: number;
  cash_amount_egp: number | string | null;
}

/**
 * Correcting a reward without throwing it away.
 *
 * It opens already holding the wrong values, because the mistake being fixed is almost always one number, and
 * it says what the reward currently pays while you type so the title and the amount are never out of sight of
 * each other.
 */
export function EditRewardForm({ r }: { r: EditableReward }) {
  const [open, setOpen] = useState(false);
  const [state, act, busy] = useActionState(updateRewardAction, undefined);
  const [title, setTitle] = useState(r.title);
  const [cash, setCash] = useState(r.cash_amount_egp === null ? "" : String(Number(r.cash_amount_egp)));
  const [kind, setKind] = useState(r.kind);
  const live = mismatchLine(title, kind === "cash" ? Number(cash) || null : null);

  if (state?.ok && open) setTimeout(() => setOpen(false), 0);

  if (!open) return <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(true)}>Edit</button>;

  return (
    <form action={act} className="w-full space-y-2 mt-2">
      <input type="hidden" name="id" value={r.id} />
      <div className="flex gap-2">
        <input name="emoji" defaultValue={r.emoji} className="input w-14 text-center" aria-label="Emoji" />
        <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} className="input flex-1" aria-label="Title" />
      </div>
      <div className="flex gap-2">
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="input flex-1" aria-label="Kind">
          <option value="privilege">privilege</option>
          <option value="item">item</option>
          <option value="cash">cash</option>
        </select>
        <input name="cost_points" type="number" min={1} defaultValue={r.cost_points} className="input w-24" aria-label="Points" />
        {kind === "cash" && (
          <input name="cash_amount_egp" type="number" min={0} step="1" value={cash} onChange={(e) => setCash(e.target.value)} className="input w-24" aria-label="EGP paid" placeholder="EGP" />
        )}
      </div>
      {live && <p className="text-xs text-bad">⚠️ {live}</p>}
      {state?.error && <p className="text-xs text-bad">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary btn-sm" disabled={busy || !!live}>{busy ? "Saving…" : "Save"}</button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
