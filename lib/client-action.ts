"use client";

/**
 * Runs a server action from a button.
 *
 * Two things can go wrong and they look nothing alike. The app may have been redeployed while the page sat
 * open, in which case the action id is stale and the right answer is to reload — nobody needs to read about
 * that. Or the action really failed, in which case it has already been logged on the server under the function
 * it happened in, and the sentence it hands back carries the reference to that row.
 */
export async function runAction<T>(fn: () => Promise<T>, onError: (msg: string) => void): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/server action|deployment|failed to fetch|unexpected response|load failed|networkerror/i.test(msg)) {
      onError("The app was just updated. Reloading…");
      setTimeout(() => window.location.reload(), 800);
      return undefined;
    }
    // A throw that reached here never went through the action's own boundary, so it has no reference yet.
    // Say where the browser was, which is the one thing the server log cannot know.
    onError(msg);
    void reportUnhandled(msg, err instanceof Error ? err.stack ?? null : null);
    return undefined;
  }
}

async function reportUnhandled(message: string, stack?: string | null): Promise<void> {
  try {
    const { reportClientErrorAction } = await import("@/lib/actions/ops");
    await reportClientErrorAction(message.slice(0, 400), null, window.location.pathname, undefined, stack ?? null);
  } catch {
    // The report is a courtesy; failing to send it must not replace the error the person is already reading.
  }
}

/** Pulls the reference out of a message so it can be shown apart from the sentence. */
export function refOf(message: string | null | undefined): string | null {
  const m = /\(ref ([23456789abcdefghjkmnpqrstuvwxyz]{6})\)/.exec(message ?? "");
  return m ? m[1] : null;
}

/** The sentence without the reference, for when the two are shown separately. */
export function withoutRef(message: string): string {
  return message.replace(/\s*\(ref [23456789abcdefghjkmnpqrstuvwxyz]{6}\)/, "").trim();
}
