/**
 * Every failure says where it happened.
 *
 * Two kinds of thing go wrong, and they deserve opposite treatment:
 *
 *  - A *refusal* is the app working correctly. "Pick a plan", "that is not one of your children". The person
 *    reads it, fixes it, moves on. It is not logged, because it is not a fault.
 *  - A *fault* is something broken: a database that said no, an AI call that failed, a file that would not
 *    read. The person gets a plain sentence and a short reference; the log gets the reference, the exact
 *    function it happened in, and whatever the underlying system actually said.
 *
 * The reference is the point. A child says "it told me k3f9a2" and that one row comes up in Admin with the
 * function, the Postgres code and the stack. Without it, a report is "it broke" and a log is a haystack.
 */
import { logError } from "./log";

/** No 0/O/1/l/i: a child reads this aloud or copies it off a phone screen. */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function newRef(): string {
  let s = "";
  for (let i = 0; i < 6; i += 1) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/** What a database, an HTTP call or a thrown value actually said, once it has been opened up. */
export interface Described {
  message: string;
  detail: string | null;
  code: string | null;
}

/**
 * Postgres and PostgREST speak in codes. A child cannot act on "23505", and neither can a parent, but the
 * sentence beside it tells them whether to try again or call for help.
 *
 * The SQLSTATE half of this table was checked by provoking each failure on the real database rather than
 * written from memory. The two PGRST codes come from PostgREST itself, above SQL, and are taken from its
 * documentation.
 */
const DB_MESSAGES: Record<string, string> = {
  "23505": "That is already saved.",
  "23503": "Something this belongs to is missing.",
  "23502": "Something required was left empty.",
  "23514": "That value is not allowed here.",
  "22001": "That is too long.",
  "22P02": "That value is in the wrong format.",
  "42501": "You are not allowed to do that.",
  "42P01": "The app looked for something that is not in the database.",
  "PGRST116": "That was not found.",
  "PGRST301": "Your sign-in has expired. Sign in again.",
  "57014": "That took too long and was stopped.",
  "53300": "The database is busy right now. Try again in a moment.",
};

interface DbErrorLike {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
}

function isDbError(v: unknown): v is DbErrorLike {
  return !!v && typeof v === "object" && ("code" in v || "details" in v || "hint" in v);
}

/**
 * Opens up whatever was thrown or returned. Supabase hands back an object with `code`, `details` and `hint`
 * that the app used to drop on the floor; those three are usually the whole story.
 */
export function describe(cause: unknown): Described {
  if (cause instanceof Fault) return { message: cause.user, detail: cause.detail, code: cause.code };
  if (isDbError(cause)) {
    const code = typeof cause.code === "string" ? cause.code : null;
    const raw = typeof cause.message === "string" ? cause.message : "";
    const bits = [raw, typeof cause.details === "string" ? cause.details : "", typeof cause.hint === "string" ? cause.hint : ""].filter(Boolean);
    return { message: (code && DB_MESSAGES[code]) || raw || "The database refused that.", detail: bits.join(" · ") || null, code };
  }
  if (cause instanceof Error) return { message: cause.message || cause.name, detail: cause.stack ?? null, code: cause.name || null };
  if (typeof cause === "string") return { message: cause, detail: null, code: null };
  if (cause === undefined || cause === null) return { message: "Something went wrong.", detail: null, code: null };
  try {
    return { message: "Something went wrong.", detail: JSON.stringify(cause).slice(0, 1000), code: null };
  } catch {
    return { message: "Something went wrong.", detail: String(cause), code: null };
  }
}

export interface FaultInit {
  /** What the person reads. Plain, short, no jargon. Defaults to whatever the cause said. */
  user?: string;
  cause?: unknown;
  meta?: Record<string, unknown>;
}

/**
 * A located failure. `where` is written by hand as a dotted path — "actions.snaps.review", "ai.lesson-script" —
 * because a minified stack in production names nothing, and a hand-written path always names the right thing.
 */
export class Fault extends Error {
  readonly where: string;
  readonly ref: string;
  readonly user: string;
  readonly detail: string | null;
  readonly code: string | null;
  readonly expected: boolean;
  readonly meta: Record<string, unknown>;

  constructor(where: string, init: FaultInit & { expected?: boolean } = {}) {
    const d = describe(init.cause);
    const user = init.user ?? d.message;
    super(`${where}: ${user}`);
    this.name = "Fault";
    this.where = where;
    this.ref = newRef();
    this.user = user;
    this.detail = d.detail;
    this.code = d.code;
    this.expected = init.expected ?? false;
    this.meta = init.meta ?? {};
    if (init.cause !== undefined) this.cause = init.cause;
  }

  /** What goes on screen: the sentence, and the reference only when there is something to look up. */
  get display(): string {
    return this.expected ? this.user : `${this.user} (ref ${this.ref})`;
  }
}

/** The app working correctly: bad input, a rule the person broke. Never logged, never given a reference. */
export function refuse(message: string): Fault {
  return new Fault("refused", { user: message, expected: true });
}

/** Something broke. Throw it; the boundary logs it with its `where` and hands the person the reference. */
export function fault(where: string, init: FaultInit = {}): Fault {
  return new Fault(where, init);
}

export function isFault(v: unknown): v is Fault {
  return v instanceof Fault;
}

/**
 * A Supabase result, checked. `const row = dbCheck("actions.rewards.add", await supabase.from(…).insert(…))`
 * replaces `if (error) return { error: error.message }`, which showed a child the raw constraint name and told
 * the log nothing at all.
 */
export function dbCheck<T>(where: string, result: { data: T; error: unknown }, user?: string): T {
  if (result.error) throw new Fault(where, { cause: result.error, user });
  return result.data;
}

/** The same, for a row that must exist: `.single()` and `.maybeSingle()` can both hand back null. */
export function dbRow<T>(where: string, result: { data: T | null; error: unknown }, user?: string): T {
  const data = dbCheck(where, result, user);
  if (data === null || data === undefined) throw new Fault(where, { user: user ?? "That was not found." });
  return data;
}

/** Context attached to a log line when the caller knows more than the request does. */
export interface FaultContext {
  familyId?: string | null;
  userId?: string | null;
  meta?: Record<string, unknown>;
}

/** Records a fault (or any thrown value) under its `where`, and gives back the reference. Never throws. */
export async function report(where: string, cause: unknown, ctx: FaultContext = {}): Promise<string> {
  const f = isFault(cause) ? cause : new Fault(where, { cause });
  if (f.expected) return f.ref;
  const d = describe(cause);
  await logError(f.where || where, cause instanceof Error ? cause : new Error(d.message), {
    familyId: ctx.familyId,
    userId: ctx.userId,
    ref: f.ref,
    meta: { ...f.meta, ...(ctx.meta ?? {}), ...(f.code ? { code: f.code } : {}), ...(f.detail ? { detail: f.detail.slice(0, 1500) } : {}) },
  });
  return f.ref;
}

/**
 * The boundary around a server action. Anything thrown inside comes back as `{ error }` with the sentence and
 * the reference, already logged under `where`; a refusal comes back as the sentence alone.
 */
export async function act<T extends object>(where: string, fn: () => Promise<T>, ctx: FaultContext = {}): Promise<T | { error: string; ref?: string }> {
  try {
    return await fn();
  } catch (err) {
    const f = isFault(err) ? err : new Fault(where, { cause: err });
    if (f.expected) return { error: f.user };
    await report(where, f, ctx);
    return { error: f.display, ref: f.ref };
  }
}

/**
 * Work that must not take the caller down with it: a bonus beside a saved prayer, a photograph beside a
 * written lesson. It used to be `catch {}`, which meant nobody ever found out. Now it leaves a line.
 */
export async function attempt<T>(where: string, fn: () => Promise<T>, fallback: T, ctx: FaultContext = {}): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    await report(where, err, ctx);
    return fallback;
  }
}

/** The same, where there is nothing to give back. */
export async function attemptVoid(where: string, fn: () => Promise<unknown>, ctx: FaultContext = {}): Promise<void> {
  await attempt(where, async () => { await fn(); }, undefined as unknown, ctx);
}

/**
 * A failure, recorded and turned into the one thing every action in this app returns: `{ error }`.
 *
 * `return failed("actions.wallet.spend", error)` replaces `return { error: error.message }`, which showed a
 * child a Postgres constraint name and told the log nothing at all. The reference travels inside the sentence
 * so it reaches the screen through every existing caller without one of them being changed.
 */
export async function failed(where: string, cause: unknown, user?: string): Promise<{ error: string }> {
  const f = isFault(cause) && cause.expected ? cause : new Fault(where, { cause, user });
  if (f.expected) return { error: f.user };
  await report(where, f);
  return { error: f.display };
}
