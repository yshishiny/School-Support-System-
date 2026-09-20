"use client";

import { useEffect, useState } from "react";
import { reportClientErrorAction } from "@/lib/actions/ops";
import { looksStale } from "@/lib/ops/stale";

const ONCE = "auto-reloaded-for";
const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/** Is the server on a newer build than the one this tab downloaded? Then the fault is the skew, not the page. */
async function serverBuild(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    // A lapsed session used to be answered with the sign-in page, and `res.json()` threw on the HTML — so the one
    // tab this check exists for, the one left open for hours, always answered "not stale".
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("application/json")) return null;
    const body = (await res.json()) as { commit?: unknown };
    return typeof body.commit === "string" ? body.commit : null;
  } catch {
    return null;
  }
}

/**
 * Most failures here are a page that outlived a deployment: refresh it once automatically.
 * A failure that survives a fresh load is a real error and is shown with its message — and reported with both
 * build stamps, so the next report says plainly whether the page was stale or the code is wrong.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [real, setReal] = useState(false);
  useEffect(() => {
    // Keyed to the build as well as the message: a tab that self-healed after one deployment must be allowed to
    // heal again after the next. Keyed to the message alone, the first "u is not a function" disarmed the reload
    // for the rest of the tab's life, and every later staleness came through as a reported fault instead.
    const marker = `${BUILD}:${error.digest ?? error.message ?? "x"}`;
    try {
      if (sessionStorage.getItem(ONCE) !== marker) {
        sessionStorage.setItem(ONCE, marker);
        window.location.reload();
        return;
      }
    } catch {
      /* storage unavailable */
    }
    let dropped = false;
    console.error("[app] error boundary", error);
    void (async () => {
      const server = await serverBuild();
      if (dropped) return;
      const stale = looksStale({ message: error.message ?? "", pageBuild: BUILD, serverBuild: server });
      setReal(!stale);
      if (!stale) {
        void reportClientErrorAction(error.message ?? "unknown", error.digest ?? null, window.location.pathname, { build: BUILD, server }, error.stack ?? null).catch(() => null);
      }
    })();
    return () => {
      dropped = true;
    };
  }, [error]);

  return (
    <main className="mx-auto max-w-sm px-4 py-16 text-center space-y-3">
      <div className="text-5xl">{real ? "😵" : "🔄"}</div>
      <h1 className="h1">{real ? "Something went wrong" : "Refreshing…"}</h1>
      <p className="muted text-sm">{real ? "This page hit an error. Try again, and if it repeats tell your parent what you were doing." : "The app was updated while this page was open."}</p>
      {real && error.message && <p className="text-[11px] muted break-words rounded-xl bg-panel-2 p-2">{error.message.slice(0, 300)}{error.digest ? ` · ${error.digest}` : ""}</p>}
      <button type="button" className="btn-primary w-full" onClick={() => window.location.reload()}>Reload page</button>
      <button type="button" className="btn-ghost w-full" onClick={reset}>Try again</button>
    </main>
  );
}
