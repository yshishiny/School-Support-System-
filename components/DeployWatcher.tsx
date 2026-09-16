"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "deploy-id";

/**
 * Keeps open tabs in step with the live deployment. When the tab comes back to the front (or every few
 * minutes) it asks the server which version is running; if it changed and nobody is typing, the page
 * refreshes itself quietly. If a form is being filled in, a small bar offers the refresh instead.
 */
export function DeployWatcher() {
  const [stale, setStale] = useState(false);
  const current = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { id } = (await res.json()) as { id: string };
        if (cancelled || !id) return;
        if (current.current === null) {
          current.current = id;
          sessionStorage.setItem(KEY, id);
          return;
        }
        if (id !== current.current) {
          const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
          if (!typing) window.location.reload();
          else setStale(true);
        }
      } catch {
        /* offline: try later */
      }
    }
    check();
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const t = setInterval(check, 4 * 60 * 1000);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); clearInterval(t); };
  }, []);

  if (!stale) return null;
  return (
    <button type="button" onClick={() => window.location.reload()} className="fixed inset-x-3 top-3 z-50 rounded-2xl border-2 border-accent bg-panel px-4 py-2.5 text-sm font-bold shadow-lg" style={{ fontFamily: "var(--font-display)" }}>
      🔄 A new version is ready. Tap to refresh when you are done.
    </button>
  );
}
