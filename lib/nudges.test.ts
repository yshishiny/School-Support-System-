import { describe, expect, it } from "vitest";
import { DEFAULT_NUDGES, dueNudges, isCatchupDay, type NudgeState } from "./nudges";

const base: NudgeState = { firstName: "Youssef", hourLocal: 7, weekday: 3, schoolOff: false, lessons: [{ subject_name: "Math", start_time: "08:00:00" }, { subject_name: "English", start_time: "09:00:00" }], checkinDone: false, streak: 3, quizzesToday: 2, quizzesDone: 0, classesToLog: 0, snapsOpen: ["Bed made"], missedCheckins: 0, missedClasses: 0, weekClosesLabel: "Thursday", appUrl: "https://x" };

describe("nudges", () => {
  it("sends a morning plan on a school day, once", () => {
    const n = dueNudges(base, DEFAULT_NUDGES, []);
    expect(n.map((x) => x.code)).toEqual(["morning"]);
    expect(n[0].text).toContain("2 classes (first Math at 08:00)");
    expect(dueNudges(base, DEFAULT_NUDGES, ["morning"])).toEqual([]);
    expect(dueNudges({ ...base, schoolOff: true }, DEFAULT_NUDGES, [])).toEqual([]);
  });
  it("nudges in the evening only while the check-in is not done", () => {
    expect(dueNudges({ ...base, hourLocal: 19, classesToLog: 2 }, DEFAULT_NUDGES, [])[0].text).toContain("2 classes to log");
    expect(dueNudges({ ...base, hourLocal: 19, checkinDone: true }, DEFAULT_NUDGES, [])).toEqual([]);
    expect(dueNudges({ ...base, hourLocal: 22 }, DEFAULT_NUDGES, ["evening"]).map((x) => x.code)).toEqual(["lastcall"]);
  });
  it("respects the settings", () => {
    expect(dueNudges({ ...base, hourLocal: 19 }, { ...DEFAULT_NUDGES, evening: false }, [])).toEqual([]);
  });
  it("adds a catch-up the day before the week closes", () => {
    expect(isCatchupDay(3, 4)).toBe(true);
    expect(isCatchupDay(4, 4)).toBe(false);
    const n = dueNudges({ ...base, hourLocal: 18, missedCheckins: 1, missedClasses: 3 }, DEFAULT_NUDGES, []);
    expect(n.map((x) => x.code)).toEqual(["catchup"]);
    expect(n[0].text).toContain("1 check-in and 3 classes to log");
  });
});
