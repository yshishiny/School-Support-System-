import { describe, expect, it } from "vitest";
import { normaliseReading } from "./read-material";

describe("normaliseReading", () => {
  it("caps topics, maps loose enum values and drops broken items instead of failing the whole reading", () => {
    const r = normaliseReading({
      title: "Grade 10 Quarter 1 Literature",
      kind: "Study Guide",
      subject: "English",
      language: "English",
      summary: "A reading list.",
      topics: Array.from({ length: 15 }, (_, i) => `Topic ${i}`),
      digest: "…",
      items: [
        { kind: "Homework", title: "Read chapter 1", subject: null, details: null, due_date: "2026-09-21", source_excerpt: "Read ch 1", confidence: "High" },
        { kind: "assignment", title: "Essay", subject: null, details: null, due_date: "next week", source_excerpt: "", confidence: "??" },
      ],
    });
    expect(r.kind).toBe("study_guide");
    expect(r.language).toBe("english");
    expect(r.topics).toHaveLength(12);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ kind: "homework", confidence: "high", due_date: "2026-09-21" });
    expect(r.items[1]).toMatchObject({ kind: "note", confidence: "low", due_date: null });
  });
});
