"use client";

import { useEffect, useState } from "react";
import { reportClientErrorAction } from "@/lib/actions/ops";

const ONCE = "auto-reloaded-for";
const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/** Is the server on a newer build than the one this tab downloaded? Then the fault is the skew, not the page. */
async function serverBuild(): Promise<string | null> {
  try {
    const res = await fetch("/api/build", { cache: "no-store" });
    const body = (await res.json()) as { id?: unknown };
    return typeof body.id === "string" ? body.id : null;
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
    const marker = error.digest ?? error.message ?? "x";
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
      const byMessage = /server action|failed to find|chunk|Loading CSS|dynamically imported module|Unexpected token '<'/i.test(error.message ?? "");
      const server = await serverBuild();
      const skewed = !!server && server !== BUILD;
      if (dropped) return;
      const stale = byMessage || skewed;
      setReal(!stale);
      if (!stale) {
        void reportClientErrorAction(error.message ?? "unknown", error.digest ?? null, window.location.pathname, { build: BUILD, server }).catch(() => null);
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
