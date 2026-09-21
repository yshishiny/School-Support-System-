import { describe, expect, it } from "vitest";
import { apply, bySubject, coverage, facets, stateOf, totals, type HeldRow, type LessonRow, type ResourceRow, type TopicRow } from "./coverage";

const NOW = new Date("2026-09-21T00:00:00Z");
const t = (over: Partial<TopicRow> = {}): TopicRow =>
  ({ id: "t1", subject: "math", unit: "Algebra", name: "Quadratics", language: "en", grade: 10, curriculumId: "us", stream: null, track: "school", ...over });
const lesson = (over: Partial<LessonRow> = {}): LessonRow =>
  ({ topic_id: "t1", grade: 10, level: "basics", model: "m", created_at: "2026-09-01T00:00:00Z", checked_at: null, failed_checks: null, human_reviewed_at: null, ...over });
const heldRow = (over: Partial<HeldRow> = {}): HeldRow =>
  ({ topic_id: "t1", level: "basics", blocking: ["no_invention"], cleared_at: null, created_at: "2026-09-20T00:00:00Z", ...over });
const res = (over: Partial<ResourceRow> = {}): ResourceRow =>
  ({ topic_id: "t1", grade: null, visuals: [{}, {}], videos: [{ url: "https://youtu.be/dQw4w9WgXcQ" }], model: "m", updated_at: "2026-09-02T00:00:00Z", ...over });

describe("stateOf — the four answers are kept apart", () => {
  it("is ready when a lesson exists and is recent", () => {
    expect(stateOf(lesson(), undefined, NOW)).toBe("ready");
  });
  it("is stale when nobody has looked in a long time", () => {
    expect(stateOf(lesson({ created_at: "2026-01-01T00:00:00Z" }), undefined, NOW)).toBe("stale");
  });
  it("is held when an attempt was written and refused", () => {
    // Not "missing": something was written, a check stopped it, and a person is owed a decision.
    expect(stateOf(undefined, heldRow(), NOW)).toBe("held");
  });
  it("is missing when nothing was ever attempted", () => {
    expect(stateOf(undefined, undefined, NOW)).toBe("missing");
  });
  it("stops counting a hold once a good lesson answered it", () => {
    expect(stateOf(undefined, heldRow({ cleared_at: "2026-09-21T00:00:00Z" }), NOW)).toBe("missing");
  });
  it("prefers the stored lesson over an old hold on the same topic", () => {
    expect(stateOf(lesson(), heldRow(), NOW)).toBe("ready");
  });
});

describe("coverage", () => {
  it("matches a lesson on topic, grade and level together", () => {
    const rows = coverage([t()], [lesson({ grade: 9 })], [], [], NOW);
    expect(rows[0].basics).toBe("missing"); // grade 9 lesson is not grade 10's
    expect(coverage([t()], [lesson()], [], [], NOW)[0].basics).toBe("ready");
  });

  it("reads the two depths separately", () => {
    const rows = coverage([t()], [lesson({ level: "basics" })], [], [heldRow({ level: "advanced" })], NOW);
    expect(rows[0].basics).toBe("ready");
    expect(rows[0].advanced).toBe("held");
  });

  it("counts diagrams and videos, which are stored per topic rather than per grade", () => {
    const rows = coverage([t()], [], [res()], [], NOW);
    expect(rows[0].visuals).toBe(2);
    expect(rows[0].videos).toBe(1);
    expect(rows[0].videoSearches).toBe(0);
  });

  it("does not count a search link as a video — every link stored so far is one", () => {
    const rows = coverage([t()], [], [res({ videos: [{ url: "https://www.youtube.com/results?search_query=x", video_id: null }] })], [], NOW);
    expect(rows[0].videos).toBe(0);
    expect(rows[0].videoSearches).toBe(1);
  });

  it("reports the newest thing written, whatever it was", () => {
    const rows = coverage([t()], [lesson({ created_at: "2026-09-01T00:00:00Z" })], [res({ updated_at: "2026-09-05T00:00:00Z" })], [], NOW);
    expect(rows[0].touchedAt).toBe("2026-09-05T00:00:00Z");
  });

  it("keeps a stored lesson's warnings apart from a held attempt's blocking checks", () => {
    const rows = coverage([t()], [lesson({ failed_checks: ["attemptable"] })], [], [heldRow({ level: "advanced" })], NOW);
    expect(rows[0].warnings).toEqual(["attemptable"]);
    expect(rows[0].blocking).toEqual(["no_invention"]);
  });

  it("does not report a cleared hold's checks as blocking anything", () => {
    const rows = coverage([t()], [], [], [heldRow({ cleared_at: "2026-09-21T00:00:00Z" })], NOW);
    expect(rows[0].blocking).toEqual([]);
  });

  it("says when a person, not a model, signed a lesson off", () => {
    expect(coverage([t()], [lesson({ human_reviewed_at: "2026-09-10T00:00:00Z" })], [], [], NOW)[0].reviewedByHuman).toBe(true);
    expect(coverage([t()], [lesson()], [], [], NOW)[0].reviewedByHuman).toBe(false);
  });
});

describe("totals", () => {
  it("counts the basics, which is the level every child can open", () => {
    const rows = coverage(
      [t({ id: "a" }), t({ id: "b" }), t({ id: "c" }), t({ id: "d" })],
      [lesson({ topic_id: "a" }), lesson({ topic_id: "b", created_at: "2026-01-01T00:00:00Z" })],
      [res({ topic_id: "a" })],
      [heldRow({ topic_id: "c" })],
      NOW,
    );
    expect(totals(rows)).toEqual({ topics: 4, ready: 1, stale: 1, held: 1, missing: 1, withVisuals: 1, withVideos: 1 });
  });
});

describe("filters", () => {
  const rows = coverage(
    [t({ id: "a", subject: "math", language: "en", grade: 10 }), t({ id: "b", subject: "arabic", language: "ar", grade: 9, curriculumId: "eg" })],
    [lesson({ topic_id: "a" })],
    [], [], NOW,
  );
  it("narrows on each axis", () => {
    expect(apply(rows, { subject: "arabic" })).toHaveLength(1);
    expect(apply(rows, { language: "ar" })[0].topic.id).toBe("b");
    expect(apply(rows, { grade: 10 })[0].topic.id).toBe("a");
    expect(apply(rows, { curriculum: "eg" })[0].topic.id).toBe("b");
    expect(apply(rows, { state: "missing" })[0].topic.id).toBe("b");
  });
  it("combines", () => expect(apply(rows, { language: "ar", state: "ready" })).toHaveLength(0));
  it("offers only values that are actually present", () => {
    expect(facets(rows)).toEqual({ curricula: ["eg", "us"], grades: [9, 10], subjects: ["arabic", "math"], languages: ["ar", "en"] });
  });
});

describe("bySubject", () => {
  it("rolls a thousand rows up into something readable, worst first", () => {
    // Math is worse off than Arabic (two gaps against one), so it leads however the names sort.
    const rows = coverage(
      [t({ id: "a", subject: "math" }), t({ id: "b", subject: "math" }), t({ id: "x", subject: "math" }), t({ id: "c", subject: "arabic", language: "ar" })],
      [lesson({ topic_id: "a" })],
      [], [], NOW,
    );
    const s = bySubject(rows);
    expect(s[0]).toEqual({ subject: "math", language: "en", total: 3, ready: 1, held: 0, missing: 2, stale: 0 });
    expect(s.map((x) => x.subject)).toEqual(["math", "arabic"]);
  });
  it("falls back to the name when two subjects are equally bare", () => {
    const rows = coverage([t({ id: "a", subject: "math" }), t({ id: "c", subject: "arabic", language: "ar" })], [], [], [], NOW);
    expect(bySubject(rows).map((x) => x.subject)).toEqual(["arabic", "math"]);
  });

  it("splits a subject taught in two languages", () => {
    const rows = coverage([t({ id: "a", subject: "math", language: "en" }), t({ id: "b", subject: "math", language: "ar" })], [], [], [], NOW);
    expect(bySubject(rows)).toHaveLength(2);
  });
});
