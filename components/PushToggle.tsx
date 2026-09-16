"use client";

import { useEffect, useState, useTransition } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction, testPushAction } from "@/lib/actions/push";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "checking" | "unsupported" | "ios-install" | "blocked" | "off" | "on" | "not-configured";

/** Turns browser notifications on for this device: registers the service worker, asks once, stores the subscription. */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!key) return setState("not-configured");
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const standalone = (navigator as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
        return setState(ios && !standalone ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [key]);

  function enable() {
    setMsg(null);
    start(async () => {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return setState(perm === "denied" ? "blocked" : "off");
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) as BufferSource });
        const j = sub.toJSON();
        const r = await savePushSubscriptionAction({ endpoint: sub.endpoint, keys: { p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" } });
        if (r.error) return setMsg(r.error);
        setState("on");
        const t = await testPushAction();
        setMsg(t.error ? `Saved, but the test failed: ${t.error}` : "On. A test notification is on its way.");
      } catch (err) {
        setMsg(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function disable() {
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
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
