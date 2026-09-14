"use client";

import { useActionState, useState } from "react";
import { createRewardAction } from "@/lib/actions/rewards";
import { Notice, SubmitButton } from "./ui";

export function AddRewardForm() {
  const [state, action] = useActionState(createRewardAction, undefined);
  const [kind, setKind] = useState("privilege");
  return (
    <form action={action} className="card space-y-3">
      <h2 className="h2">Add a reward</h2>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="label">Title</label>
          <input name="title" className="input" required placeholder="e.g. 500 EGP, Pizza night, 2h extra gaming" />
        </div>
        <div>
          <label className="label">Emoji</label>
          <input name="emoji" className="input" defaultValue="🎁" />
        </div>
        <div>
          <label className="label">Type</label>
          <select name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="privilege">Privilege</option>
            <option value="item">Item</option>
          </select>
        </div>
        <div>
          <label className="label">Cost (points)</label>
          <input name="cost_points" type="number" min={1} className="input" required defaultValue={200} />
        </div>
        {kind === "cash" && (
          <div>
            <label className="label">EGP</label>
            <input name="cash_amount_egp" type="number" min={1} className="input" defaultValue={100} />
          </div>
        )}
        <div className="col-span-3">
          <label className="label">Description (optional)</label>
          <input name="description" className="input" />
        </div>
      </div>
      <Notice error={state?.error} />
      <SubmitButton pendingText="Adding…">Add reward</SubmitButton>
    </form>
  );
}
