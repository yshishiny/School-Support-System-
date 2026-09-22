/**
 * Reading a structured reply, and saying what went wrong when there isn't one.
 *
 * Every one of these calls used to check only for a refusal and then hand the text straight to `JSON.parse`.
 * When a reply hit its token ceiling the JSON stopped mid-string, and the error a parent saw was
 *
 *     Failed to parse structured output as JSON: Unterminated string in JSON at position 41055
 *
 * which names neither the cause nor the cure. `stop_reason` had said `max_tokens` all along; nobody looked.
 * The nightly job then reported the whole run as failed with that message attached.
 *
 * So: read the stop reason first, always, and let the parse failure mean what it actually means — a reply that
 * finished and still was not valid.
 */
import type Anthropic from "@anthropic-ai/sdk";

export interface Finished {
  stop_reason: Anthropic.Message["stop_reason"];
  content: Anthropic.Message["content"];
  usage?: { output_tokens?: number };
}

/** The reply's text, with the thinking and tool blocks left out. */
export function textOf(message: Finished): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export class Truncated extends Error {
  constructor(what: string, limit: number, got: number | undefined) {
    super(
      `The model ran out of room writing ${what}: it hit the ${limit.toLocaleString()}-token limit${
        got ? ` after ${got.toLocaleString()} tokens` : ""
      } and the reply was cut off part-way, so there is nothing complete to store. Ask for less at once, or raise the limit for this step.`,
    );
    this.name = "Truncated";
  }
}

export class Declined extends Error {
  constructor(what: string) {
    super(`The model declined to write ${what}.`);
    this.name = "Declined";
  }
}

/**
 * Checks how the reply ended, then parses it.
 *
 * `what` is a plain noun phrase that finishes "writing …" — "this quiz", "the lesson", "this file's summary" —
 * because the message is read by a parent, not by whoever wrote the call.
 */
export function readStructured<T>(message: Finished, schema: { parse: (v: unknown) => T }, what: string, limit: number): T {
  if (message.stop_reason === "refusal") throw new Declined(what);
  if (message.stop_reason === "max_tokens") throw new Truncated(what, limit, message.usage?.output_tokens);

  const text = textOf(message);
  if (text.trim() === "") throw new Error(`The model returned nothing at all for ${what}.`);
  try {
    return schema.parse(JSON.parse(text));
  } catch (err) {
    // A reply that ended cleanly and still is not valid JSON is a different fault from a truncated one, and
    // conflating the two is what hid the real cause for weeks.
    const why = err instanceof Error ? err.message : String(err);
    throw new Error(`The reply for ${what} finished but could not be read: ${why}`);
  }
}
