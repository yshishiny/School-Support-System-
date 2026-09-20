import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Who is holding the phone, available to the error log without being handed down through every function.
 *
 * Every request starts at requireSession, which puts the signed-in child or parent here; anything that fails
 * further down is recorded against them without a single extra argument. Passing the ids by hand meant most
 * failures were logged against nobody, which is the same as not knowing.
 */
export interface Who {
  userId: string;
  familyId: string;
  name: string;
  role: string;
}

const store = new AsyncLocalStorage<Who>();

/** Called once per request, at sign-in check. Everything after it in the same request can see it. */
export function rememberWho(w: Who): void {
  try {
    store.enterWith(w);
  } catch {
    // Not every runtime carries async context; the log simply falls back to "nobody".
  }
}

export function who(): Who | null {
  try {
    return store.getStore() ?? null;
  } catch {
    return null;
  }
}
