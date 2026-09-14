"use client";

import { useActionState } from "react";
import { redeemRewardAction } from "@/lib/actions/rewards";
import { Notice, SubmitButton } from "./ui";

export function RedeemButton({ rewardId, disabled }: { rewardId: string; disabled: boolean }) {
  const [state, action] = useActionState(redeemRewardAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="reward_id" value={rewardId} />
      {disabled ? (
        <button type="button" className="btn-ghost btn-sm w-full" disabled>Not enough points</button>
      ) : (
        <SubmitButton className="btn-primary btn-sm w-full" pendingText="Requesting…">Redeem</SubmitButton>
      )}
      <Notice error={state?.error} ok={state?.ok} />
    </form>
  );
}
