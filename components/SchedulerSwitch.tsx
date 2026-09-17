"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disableHourlySchedulerAction, enableHourlySchedulerAction } from "@/lib/actions/ops-scheduler";
import { runAction } from "@/lib/client-action";

export function SchedulerSwitch({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {enabled ? (
        <button type="button" disabled={pending} className="btn-ghost btn-sm" onClick={() => start(async () => { await runAction(() => disableHourlySchedulerAction(), setMsg); router.refresh(); })}>Switch off</button>
      ) : (
        <button type="button" disabled={pending} className="btn-primary btn-sm" onClick={() => start(async () => { const r = await runAction(() => enableHourlySchedulerAction(), setMsg); if (r?.error) setMsg(r.error); router.refresh(); })}>Switch on hourly reminders</button>
      )}
      {msg && <span className="text-xs text-bad">{msg}</span>}
    </div>
  );
}
