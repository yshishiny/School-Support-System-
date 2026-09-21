"use client";

import { useActionState, useState, useTransition } from "react";
import { connectChildTelegramAction, disconnectChildTelegramAction, testChildReminderAction } from "@/lib/actions/children";

/**
 * Whether anything the app sends can actually land on this child's phone, and the two buttons that fix it.
 *
 * This is here because its absence is why the reminders never worked: browser push was configured correctly,
 * the hourly job ran, and not one child had ever been subscribed — and no screen in the app said so, so it went
 * unnoticed for a week while the job reported success. A channel that can silently be empty has to be visible.
 */
export function ChildReminders({
  studentId, firstName, push, telegram, botUsername,
}: { studentId: string; firstName: string; push: number; telegram: boolean; botUsername: string | null }) {
  const [state, connect, connecting] = useActionState(connectChildTelegramAction, undefined);
  const [test, setTest] = useState<string | null>(null);
  const [testing, startTest] = useTransition();
  const reachable = push > 0 || telegram;

  return (
    <div className="space-y-2">
      <p className={`text-sm ${reachable ? "" : "text-bad"}`}>
        {reachable
          ? <>Reminders reach {firstName} {[push > 0 ? `on ${push} phone${push === 1 ? "" : "s"} in the browser` : null, telegram ? "on Telegram" : null].filter(Boolean).join(" and ")}.</>
          : <><b>Nothing can reach {firstName}.</b> He has no browser notifications and no Telegram, so every reminder the app sends is only seen if he opens the app himself.</>}
      </p>

      <ul className="text-sm divide-y divide-line">
        <li className="py-2 flex items-center gap-3">
          <span className="flex-1">
            Browser notifications
            <span className="block text-xs muted">
              {push > 0
                ? `On, on ${push} device${push === 1 ? "" : "s"}.`
                : `Off. ${firstName} turns this on himself from Today — his phone can only be asked once, so it is offered where he wants it.`}
            </span>
          </span>
          <span className={`badge shrink-0 ${push > 0 ? "text-good" : "muted"}`}>{push > 0 ? "on" : "off"}</span>
        </li>

        <li className="py-2 space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="flex-1">
              Telegram
              <span className="block text-xs muted">
                {telegram
                  ? "Connected. Works on any phone and survives a reinstall."
                  : botUsername
                    ? <>Have {firstName} open <b>@{botUsername}</b> in Telegram and tap <b>Start</b>, then press Connect below.</>
                    : "The bot username is not configured on the server."}
              </span>
            </span>
            <span className={`badge shrink-0 ${telegram ? "text-good" : "muted"}`}>{telegram ? "on" : "off"}</span>
          </div>

          {telegram ? (
            <form action={disconnectChildTelegramAction}>
              <input type="hidden" name="student_id" value={studentId} />
              <button className="btn-ghost btn-sm">Disconnect</button>
            </form>
          ) : (
            <form action={connect} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="student_id" value={studentId} />
              <input name="telegram_chat_id" className="input flex-1 min-w-[10rem] py-1.5" placeholder="leave empty after he taps Start" />
              <button className="btn-primary btn-sm" disabled={connecting}>{connecting ? "…" : "Connect"}</button>
            </form>
          )}
          {state?.error && <p className="text-xs text-bad">{state.error}</p>}
          {state?.ok && <p className="text-xs text-good">{state.ok}</p>}
        </li>
      </ul>

      <div className="flex items-center gap-2">
        <button
          type="button" className="btn-ghost btn-sm" disabled={testing || !reachable}
          onClick={() => startTest(async () => {
            const fd = new FormData();
            fd.set("student_id", studentId);
            const r = await testChildReminderAction(fd);
            setTest(r.error ?? r.ok ?? null);
          })}
        >
          {testing ? "Sending…" : "Send a test now"}
        </button>
        {test && <span className="text-xs muted">{test}</span>}
      </div>
    </div>
  );
}
