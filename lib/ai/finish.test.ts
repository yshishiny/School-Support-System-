import { describe, expect, it } from "vitest";
import { Declined, Truncated, readStructured, textOf, type Finished } from "./finish";

const schema = { parse: (v: unknown) => v as { ok: boolean } };
const msg = (over: Partial<Finished> = {}): Finished =>
  ({ stop_reason: "end_turn", content: [{ type: "text", text: '{"ok":true}', citations: null }] as Finished["content"], ...over });

describe("textOf", () => {
  it("joins the text and leaves thinking out of it", () => {
    const m = msg({ content: [
      { type: "thinking", thinking: "hmm", signature: "" },
      { type: "text", text: "a", citations: null },
      { type: "text", text: "b", citations: null },
    ] as unknown as Finished["content"] });
    expect(textOf(m)).toBe("ab");
  });
});

describe("readStructured", () => {
  it("parses a reply that finished", () => {
    expect(readStructured(msg(), schema, "this quiz", 12000)).toEqual({ ok: true });
  });

  it("says the reply was cut off rather than blaming the JSON", () => {
    // The real failure: stop_reason said max_tokens and nobody looked, so the parent was shown
    // "Unterminated string in JSON at position 41055".
    const cut = msg({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"ok":tr' }] as Finished["content"], usage: { output_tokens: 12000 } });
    expect(() => readStructured(cut, schema, "this quiz", 12000)).toThrow(Truncated);
    expect(() => readStructured(cut, schema, "this quiz", 12000)).toThrow(/ran out of room writing this quiz/);
  });

  it("puts the limit and what it used in the message, so the fix is obvious", () => {
    const cut = msg({ stop_reason: "max_tokens", content: [] as Finished["content"], usage: { output_tokens: 12000 } });
    try {
      readStructured(cut, schema, "the lesson", 12000);
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error).message).toContain("12,000-token limit");
      expect((err as Error).message).toContain("after 12,000 tokens");
    }
  });

  it("still reports a refusal as a refusal", () => {
    expect(() => readStructured(msg({ stop_reason: "refusal" }), schema, "this quiz", 12000)).toThrow(Declined);
  });

  it("checks how it ended before it tries to parse", () => {
    // A truncated reply is usually also unparseable. The stop reason is the true cause and must win.
    const cut = msg({ stop_reason: "max_tokens", content: [{ type: "text", text: "not json at all" }] as Finished["content"] });
    expect(() => readStructured(cut, schema, "x", 100)).toThrow(Truncated);
  });

  it("keeps a genuine parse failure separate from a truncation", () => {
    const bad = msg({ content: [{ type: "text", text: "{oops" }] as Finished["content"] });
    expect(() => readStructured(bad, schema, "this quiz", 12000)).toThrow(/finished but could not be read/);
    expect(() => readStructured(bad, schema, "this quiz", 12000)).not.toThrow(Truncated);
  });

  it("says so when the reply is empty, rather than throwing a parse error", () => {
    const empty = msg({ content: [{ type: "text", text: "   " }] as Finished["content"] });
    expect(() => readStructured(empty, schema, "this quiz", 12000)).toThrow(/returned nothing at all/);
  });

  it("surfaces a schema failure with the reason attached", () => {
    const strict = { parse: () => { throw new Error("questions: expected array"); } };
    expect(() => readStructured(msg(), strict, "this quiz", 12000)).toThrow(/questions: expected array/);
  });
});
