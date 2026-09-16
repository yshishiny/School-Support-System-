import { describe, expect, it } from "vitest";
import { buildQueue } from "./today-queue";

const base = {
  hourLocal: 14,
  prayerOpen: null,
  plannedToday: [{ id: "q1", title: "Physics · Motion", done: false, slot: "school" }],
  catchup: [],
  checkinDone: false,
  classesToday: 4,
  hasNotes: false,
  recallDone: false,
  dueCheck: null,
  reviewsDue: 0,
  learnerDone: true,
};

describe("buildQueue", () => {
  it("puts an open prayer first, then the quiz, then the check-in in the afternoon", () => {
    const q = buildQueue({ ...base, prayerOpen: { prayer: "asr", label: "Asr", time: "15:41" } });
    expect(q.map((x) => x.kind)).toEqual(["prayer", "quiz", "checkin"]);
  });
  it("moves the check-in to the front in the evening", () => {
    const q = buildQueue({ ...base, hourLocal: 19 });
    expect(q[0].kind).toBe("checkin");
  });
  it("skips done things and ends with a done card when nothing is left", () => {
    const q = buildQueue({ ...base, plannedToday: [{ id: "q1", title: "x", done: true, slot: "school" }], checkinDone: true });
    expect(q).toHaveLength(1);
    expect(q[0].kind).toBe("done");
  });
  it("adds recall, reviews, catch-up and the intake in that order after the essentials", () => {
    const q = buildQueue({ ...base, checkinDone: true, hasNotes: true, reviewsDue: 3, catchup: [{ id: "c1", title: "Math · old" }], learnerDone: false });
    expect(q.map((x) => x.kind)).toEqual(["quiz", "recall", "review", "catchup", "learner"]);
  });
});
