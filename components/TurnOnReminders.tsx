"use client";

import { useEffect, useState, useTransition } from "react";
import { testPushAction } from "@/lib/actions/push";
import { enablePush, pushState, type PushState } from "@/lib/push/client";

const HIDDEN = "reminders-asked";

/**
 * The ask, where a child will meet it.
 *
 * The switch for this already existed — on Me, behind a tab called More, below the fold. In the whole database one
 * push subscription exists and it belongs to a parent: Omar and Youssef installed the app and were never once
 * asked. So the nudge job has run every hour for days, reported success, and sent nothing, because it correctly
 * has nobody to send to.
 *
 * Two rules, and they are why this sits here rather than on first load. A browser offers the permission prompt
 * **once per install** — a no is permanent until somebody digs through browser settings — so it is only worth
 * spending at a moment the child wants what is behind it. And it says what it will actually do for him, in his
 * words, because "enable notifications" is a request and "I'll tell you before you lose your allowance" is an offer.
 */
export function TurnOnReminders({ firstName }: { firstName: string }) {
  const [state, setState] = useState<PushState>("checking");
  const [msg, setMsg] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);
  const [pending, start] = useTransition();

  useEffect(() => {
    let dropped = false;
    (async () => {
      const s = await pushState();
      if (dropped) return;
      setState(s);
      try {
        setHidden(sessionStorage.getItem(HIDDEN) === "1");
      } catch {
        setHidden(false);
      }
    })();
    return () => { dropped = true; };
  }, []);

  // Nothing to offer: already on, said no already, or this browser cannot do it at all.
  if (hidden || state === "checking" || state === "on" || state === "blocked" || state === "unsupported" || state === "not-configured") {
    return null;
  }

  function dismiss() {
    try { sessionStorage.setItem(HIDDEN, "1"); } catch { /* storage unavailable */ }
    setHidden(true);
  }

  if (state === "ios-install") {
    return (
      <div className="card !py-3 flex items-start gap-3">
        <span className="text-2xl leading-none">📲</span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>Want reminders, {firstName}?</div>
          <p className="text-xs muted mt-0.5">
            On iPhone, tap <strong>Share</strong> → <strong>Add to Home Screen</strong> first, then open it from
            there and come back — Safari cannot send reminders otherwise.
          </p>
        </div>
        <button type="button" className="text-xs muted shrink-0" onClick={dismiss}>later</button>
      </div>
    );
  }

  return (
    <div className="card !py-3 space-y-2 border-2 border-accent/40">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">🔔</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>
            Shall I remind you, {firstName}?
          </div>
          <ul className="text-xs muted mt-1 space-y-0.5">
            <li>· before a prayer window closes</li>
            <li>· when a snap is still owed</li>
            <li>· before the week closes, so you do not lose the allowance</li>
          </ul>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button" className="btn-primary btn-sm" disabled={pending}
          onClick={() => start(async () => {
            const r = await enablePush();
            setState(r.state);
            if (r.error) return setMsg(r.error);
            if (r.state !== "on") return setMsg(r.state === "blocked" ? "You said no — your phone will not ask again." : null);
            // Prove it works, to him and to the log, rather than assuming.
            const t = await testPushAction();
            setMsg(t.error ? `Saved, but the test did not arrive: ${t.error}` : "Done — a test is on its way 🔔");
          })}
        >
          {pending ? "…" : "Yes, remind me"}
        </button>
        <button type="button" className="text-xs muted" onClick={dismiss}>not now</button>
      </div>
      {msg && <p className="text-xs muted">{msg}</p>}
    </div>
  );
}
