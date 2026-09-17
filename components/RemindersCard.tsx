"use client";

import { useOptimistic, useTransition } from "react";
import { PushToggle } from "./PushToggle";
import { setNudgesAction } from "@/lib/actions/push";
import type { NudgeSettings } from "@/lib/nudges";

const ITEMS: { key: "wakeup" | "morning" | "evening" | "lastcall" | "prayers"; label: string; hint: string }[] = [
  { key: "wakeup", label: "⏰ Wake-up call", hint: "at 6 on school days: Fajr, bed, sandwich, bag, then “I'm ready”" },
  { key: "morning", label: "☀️ Morning plan", hint: "around 7: today's classes, quizzes and snaps" },
  { key: "evening", label: "🌙 Evening round", hint: "around 19: check-in, classes to log, quizzes" },
  { key: "lastcall", label: "⏰ Last call", hint: "around 21:30 if the check-in is still missing" },
];

/** The child's reminder settings: browser notifications on this device, and which reminders to get. */
export function RemindersCard({ settings }: { settings: NudgeSettings }) {
  const [state, setState] = useOptimistic(settings);
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="h2">🔔 Reminders</h2>
        <p className="text-xs muted">Notifications on this phone, even when the app is closed. One in the morning, one in the evening, a last call if needed. Nothing once the job is done.</p>
      </div>
      <PushToggle />
      <ul className="divide-y divide-line text-sm">
        {ITEMS.map((it) => (
          <li key={it.key} className="py-2 flex items-center gap-2">
            <label className="flex-1">
              <div className="font-medium">{it.label}</div>
              <div className="text-xs muted">{it.hint}</div>
            </label>
            <input type="checkbox" checked={state[it.key] !== false} disabled={pending} onChange={(e) => { const v = e.target.checked; start(async () => { setState({ ...state, [it.key]: v }); await setNudgesAction({ [it.key]: v }); }); }} />
          </li>
        ))}
      </ul>
    </section>
  );
}
