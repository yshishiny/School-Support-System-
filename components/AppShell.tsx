"use client";

import { useEffect } from "react";
import { reportDeviceAction, type DeviceInfo } from "@/lib/actions/device";

declare global {
  interface Window { __installPrompt?: { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null }
}

function platformOf(ua: string): string {
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "other";
}

/** Runs once per page load: registers the service worker, keeps the install prompt, reports the device once per session. */
export function AppShell() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => null);
    const onPrompt = (e: Event) => { e.preventDefault(); window.__installPrompt = e as unknown as Window["__installPrompt"]; window.dispatchEvent(new Event("install-available")); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => { window.__installPrompt = null; window.dispatchEvent(new Event("install-done")); });
    (async () => {
      try {
        if (sessionStorage.getItem("device-reported")) return;
        const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }>; connection?: { effectiveType?: string; type?: string }; standalone?: boolean };
        const bat = nav.getBattery ? await nav.getBattery().catch(() => null) : null;
        const info: DeviceInfo = {
          platform: platformOf(navigator.userAgent),
          standalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true || new URLSearchParams(location.search).get("source") === "app",
          ua: navigator.userAgent,
          screen: `${window.innerWidth}x${window.innerHeight}@${(window.devicePixelRatio || 1).toFixed(1)}`,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          battery: bat ? Math.round(bat.level * 100) : null,
          charging: bat ? bat.charging : null,
          connection: nav.connection?.effectiveType ?? nav.connection?.type ?? null,
          source: new URLSearchParams(location.search).get("source"),
        };
        await reportDeviceAction(info);
        sessionStorage.setItem("device-reported", "1");
      } catch { /* not signed in, or storage unavailable */ }
    })();
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return null;
}
