"use client";

/**
 * Runs a server action from a button. If the action id is stale because the app was redeployed
 * while the page was open, reload once instead of showing an error screen.
 */
export async function runAction<T>(fn: () => Promise<T>, onError: (msg: string) => void): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/server action|deployment|failed to fetch|unexpected response/i.test(msg)) {
      onError("The app was just updated. Reloading…");
      setTimeout(() => window.location.reload(), 800);
      return undefined;
    }
    onError(msg);
    return undefined;
  }
}
