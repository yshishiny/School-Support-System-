"use client";

/** Shown when a page action fails, most often because the site was updated while the page was open. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-sm px-4 py-16 text-center space-y-3">
      <div className="text-5xl">🔄</div>
      <h1 className="h1">Please reload</h1>
      <p className="muted text-sm">The app was probably updated while this page was open. Reloading fixes it.</p>
      <button type="button" className="btn-primary w-full" onClick={() => window.location.reload()}>Reload page</button>
      <button type="button" className="btn-ghost w-full" onClick={reset}>Try again</button>
    </main>
  );
}
