"use client";

import { useEffect, useState, useTransition } from "react";
import { testPushAction } from "@/lib/actions/push";
import { disablePush, enablePush, pushState, vapidKey, type PushState as State } from "@/lib/push/client";

/** Turns browser notifications on for this device: registers the service worker, asks once, stores the subscription. */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const key = vapidKey();
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    pushState().then(setState).catch(() => setState("unsupported"));
  }, [key]);

  function enable() {
    setMsg(null);
    start(async () => {
      const r = await enablePush();
      setState(r.state);
      if (r.error) return setMsg(r.error);
      if (r.state !== "on") return;
      const t = await testPushAction();
      setMsg(t.error ? `Saved, but the test failed: ${t.error}` : "On. A test notification is on its way.");
    });
  }

  function disable() {
    start(async () => {
      await disablePush();
      setState("off");
      setMsg(null);
    });
  }

  const line =
    state === "checking" ? "Checking…"
    : state === "not-configured" ? "Not set up on the server yet."
    : state === "unsupported" ? "This browser cannot show notifications. Chrome or Brave on Android works best."
    : state === "ios-install" ? "On iPhone: share → Add to Home Screen, open it from there, then come back here."
    : state === "blocked" ? "Blocked in the browser. Tap the lock icon in the address bar → Notifications → Allow, then reload."
    : state === "on" ? "On for this device 🔔"
    : "Off";

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="flex-1 min-w-0">{line}</span>
        {state === "off" && <button type="button" disabled={pending} className="btn-primary btn-sm" onClick={enable}>{pending ? "…" : "🔔 Turn on"}</button>}
        {state === "on" && (
          <>
            <button type="button" disabled={pending} className="btn-ghost btn-sm" onClick={() => start(async () => { const t = await testPushAction(); setMsg(t.error ?? `Test sent to ${t.sent} device${t.sent === 1 ? "" : "s"}.`); })}>Test</button>
            <button type="button" disabled={pending} className="text-xs muted" onClick={disable}>turn off</button>
          </>
        )}
      </div>
      {msg && <p className="text-xs muted">{msg}</p>}
    </div>
  );
}
