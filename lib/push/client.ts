"use client";

import { removePushSubscriptionAction, reportPushFaultAction, savePushSubscriptionAction } from "@/lib/actions/push";

/**
 * Turning notifications on, from the browser.
 *
 * This lived inside the settings toggle, which is why it was only ever reachable from a screen called "More" on a
 * tab a child never opened — one push subscription exists in this whole database and it belongs to a parent. The
 * logic moves here so the same, tested path can be offered wherever a child will actually say yes.
 */

export type PushState =
  | "checking"
  | "unsupported"
  | "ios-install"   // iPhone, not yet added to the home screen: Safari will not even offer it
  | "blocked"       // said no once; only the browser's own settings can undo that
  | "off"
  | "on"
  | "not-configured"
  | "broken";       // the browser can do this, but registering the worker failed — a fault, not a refusal

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function vapidKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}

/** Where this device stands, without asking the child anything. */
export async function pushState(): Promise<PushState> {
  if (!vapidKey()) return "not-configured";
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = (navigator as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    return ios && !standalone ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const sub = await reg.pushManager.getSubscription();
    return sub ? "on" : "off";
  } catch (err) {
    // This used to return "unsupported", which the card reads as "nothing to offer" and renders nothing. A
    // browser that supports push but could not register the worker is a fault on our side — most likely the
    // script answering with something that is not JavaScript — and it has to be visible, not swallowed.
    void reportPushFaultAction(err instanceof Error ? err.message : String(err));
    return "broken";
  }
}

/**
 * Asks, and stores the answer.
 *
 * The prompt can only be shown once per browser, ever — a "no" is permanent until the child digs into browser
 * settings. That is the whole reason this must be asked at a moment he wants it, and never on first load.
 */
export async function enablePush(): Promise<{ state: PushState; error?: string }> {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { state: perm === "denied" ? "blocked" : "off" };
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey()) as BufferSource,
    });
    const j = sub.toJSON();
    const r = await savePushSubscriptionAction({
      endpoint: sub.endpoint,
      keys: { p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" },
    });
    if (r.error) return { state: "off", error: r.error };
    return { state: "on" };
  } catch (err) {
    return { state: "off", error: err instanceof Error ? err.message : String(err) };
  }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await removePushSubscriptionAction(sub.endpoint);
    await sub.unsubscribe();
  }
}
