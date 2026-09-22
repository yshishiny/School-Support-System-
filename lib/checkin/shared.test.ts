import { describe, expect, it } from "vitest";
import { sharedChips, titleKey, type SharedFile } from "./shared";

const f = (title: string, topics: string[] = [], createdAt: string | null = null): SharedFile => ({ title, topics, createdAt });

// The real English bucket that rendered as one thirteen-document paragraph on Omar's check-in page.
const REAL: SharedFile[] = [
  f("Story Elements: Analyzing 'The Door at Midnight' Through a Literature Circle", ["Setting: where and when a story takes place", "Characters: who appears in the story"], "2026-09-22T10:35:39Z"),
  f("Story Settings Description", ["descriptive writing", "story settings"], "2026-09-22T10:12:06Z"),
  f("Crafting Compelling Settings", ["Definition of setting: where and when", "Sensory description (sights, sounds, smells, sensations)"], "2026-09-22T10:35:05Z"),
  f("Story Elements: Analyzing 'The Door at Midnight' through a Literature Circle", ["Story elements: setting, character, conflict"], "2026-09-22T10:14:08Z"),
  f("Subject-Verb Agreement: SAT-Style Practice", ["Subject-verb agreement rules", "Singular subjects and verbs"], "2026-09-22T10:00:58Z"),
  f("Crafting Compelling Settings", ["Definition of setting: where and when"], "2026-09-22T10:00:28Z"),
  f("Story Settings Description", ["descriptive writing", "setting description"], "2026-09-22T09:59:55Z"),
  f("Story Settings Description: Haunted House", ["descriptive writing", "mood and atmosphere"], "2026-09-22T10:34:56Z"),
  f("Crafting Compelling Settings", ["Setting definition (where and when)"], "2026-09-22T10:12:30Z"),
  f("Subject–Verb Agreement: SAT-Style Practice", ["Singular subject + singular verb"], "2026-09-22T10:35:29Z"),
  f("Story Settings Description", ["descriptive writing", "creative vocabulary"], "2026-09-22T10:12:15Z"),
  f("Story Settings Description", ["descriptive writing", "adjectives and mood words"], "2026-09-22T10:00:15Z"),
  f("Subject–Verb Agreement: SAT-Style Practice", ["Singular subject–singular verb rule"], "2026-09-22T10:12:55Z"),
];

describe("titleKey", () => {
  it("treats an en dash and a hyphen as the same document", () => {
    expect(titleKey("Subject–Verb Agreement: SAT-Style Practice")).toBe(titleKey("Subject-Verb Agreement: SAT-Style Practice"));
  });

  it("ignores case and the subtitle punctuation the model varies between passes", () => {
    expect(titleKey("Story Elements: Analyzing 'The Door at Midnight' Through a Literature Circle"))
      .toBe(titleKey("Story Elements: Analyzing 'The Door at Midnight' through a Literature Circle"));
  });

  it("does not collapse two genuinely different sheets", () => {
    expect(titleKey("Story Settings Description")).not.toBe(titleKey("Crafting Compelling Settings"));
  });
});

describe("sharedChips — against the real thirteen", () => {
  it("collapses thirteen entries to the five documents they actually are", () => {
    // Five, not four: the two "Story Settings Description" sheets are genuinely different worksheets — one
    // about a beach, one about a haunted house — with different content hashes. Merging them on title alone
    // would lose one of the child's real sheets, which is worse than showing two similar names.
    const { chips, more } = sharedChips(REAL, 99);
    expect(chips).toHaveLength(5);
    expect(more).toBe(0);
  });

  it("shows three and counts the rest instead of hiding them", () => {
    const { chips, more } = sharedChips(REAL);
    expect(chips).toHaveLength(3);
    expect(more).toBe(2);
  });

  it("keeps the newest copy of a duplicate", () => {
    const { chips } = sharedChips(REAL, 99);
    const settings = chips.find((c) => c.title.startsWith("Crafting"))!;
    // The 10:35 upload carries two topics; the 10:00 one carries only the first.
    expect(settings.hint).toContain("Sensory description");
  });

  it("puts the newest document first", () => {
    expect(sharedChips(REAL).chips[0].title).toContain("Story Elements");
  });
});

describe("sharedChips — hints", () => {
  it("drops a topic the title already says", () => {
    const { chips } = sharedChips([f("Story Settings Description", ["setting description", "sensory language"])]);
    expect(chips[0].hint).toEqual(["sensory language"]);
  });

  it("gives at most two", () => {
    const { chips } = sharedChips([f("X", ["one thing", "two thing", "three thing", "four thing"])]);
    expect(chips[0].hint).toHaveLength(2);
  });

  it("cuts a topic at its colon, because the tail is a definition not a name", () => {
    const { chips } = sharedChips([f("Elements", ["Atomic structure: protons, neutrons and the nucleus in detail"])]);
    expect(chips[0].hint[0]).toBe("Atomic structure");
  });

  it("drops a topic too long to read at a glance", () => {
    const long = "a".repeat(60);
    expect(sharedChips([f("X", [long])]).chips[0].hint).toEqual([]);
  });

  it("is happy with no topics at all", () => {
    expect(sharedChips([f("Just a title")]).chips[0].hint).toEqual([]);
  });
});

describe("sharedChips — edges", () => {
  it("returns nothing for nothing", () => {
    expect(sharedChips([])).toEqual({ chips: [], more: 0 });
  });

  it("never lets an undated file displace a dated one", () => {
    const { chips } = sharedChips([f("Sheet", ["dated"], "2026-09-22T10:00:00Z"), f("Sheet", ["undated"], null)], 99);
    expect(chips[0].hint).toEqual(["dated"]);
  });
});
