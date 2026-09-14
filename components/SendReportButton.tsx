"use client";

import { useActionState } from "react";
import { sendReportNowAction } from "@/lib/actions/reports";
import { Notice, SubmitButton } from "./ui";

export function SendReportButton() {
  const [state, action] = useActionState(sendReportNowAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton className="btn-primary" pendingText="Generating…">Generate & send today's report</SubmitButton>
      <Notice error={state?.error} ok={state?.ok} />
    </form>
  );
}
