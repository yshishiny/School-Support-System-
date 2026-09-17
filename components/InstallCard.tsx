"use client";

import { useEffect, useState } from "react";

type State = "installed" | "prompt" | "ios" | "manual";

/** "Install the app": one tap on Android Chrome, instructions elsewhere, a tick once it runs from the icon. */
export function InstallCard({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("manual");
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const refresh = () => setState(standalone ? "installed" : window.__installPrompt ? "prompt" : ios ? "ios" : "manual");
    refresh();
    window.addEventListener("install-available", refresh);
    window.addEventListener("install-done", () => setState("installed"));
    return () => window.removeEventListener("install-available", refresh);
  }, []);
  async function install() {
    const p = window.__installPrompt;
    if (!p) return;
    await p.prompt();
    const r = await p.userChoice;
    if (r.outcome === "accepted") setState("installed");
  }
  if (state === "installed") return compact ? null : <p className="card !py-2.5 text-sm">📱 <b>App installed.</b> You are running Study Portal from its icon. Notifications and the daily reminders work best this way.</p>;
  return (
    <section className={`card space-y-2 ${compact ? "!py-3" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-3xl">📱</span>
        <div className="flex-1 text-sm"><b>Install the app on this phone</b><div className="text-xs muted">Same app, its own icon, full screen, and notifications that arrive even when the browser is closed.</div></div>
        {state === "prompt" && <button type="button" className="btn-primary btn-sm" onClick={install}>Install</button>}
      </div>
      {state === "ios" && <p className="text-xs muted">iPhone: tap Share (the square with the arrow), then “Add to Home Screen”. Notifications need the installed app on iPhone.</p>}
      {state === "manual" && <p className="text-xs muted">Android Chrome: menu ⋮ → “Add to Home screen” or “Install app”. On a laptop: the install icon at the right of the address bar.</p>}
    </section>
  );
}
