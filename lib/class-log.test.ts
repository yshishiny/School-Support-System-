import { describe, expect, it } from "vitest";
import { classComplete, classLogCoverage, classesOn, missingLine, nextClassDate } from "./class-log";

// 2026-09-13 Sun … 2026-09-17 Thu
const tt = [
  { weekday: 0, subject_name: "Math" },
  { weekday: 0, subject_name: "P.E." },
  { weekday: 1, subject_name: "Math" },
  { weekday: 1, subject_name: "Science" },
  { weekday: 2, subject_name: "Arabic" },
  { weekday: 4, subject_name: "Math" },
];

describe("class log", () => {
  it("requires a note and the homework answer", () => {
    expect(classComplete(undefined)).toBe(false);
    expect(classComplete({ log_date: "d", subject_name: "Math", note: "Fractions", homework_given: null })).toBe(false);
    expect(classComplete({ log_date: "d", subject_name: "Math", note: "Fractions", homework_given: false })).toBe(true);
  });
  it("skips P.E. and days off", () => {
    expect(classesOn("2026-09-13", tt)).toEqual(["Math"]);
    expect(classesOn("2026-09-13", tt, ["2026-09-13"])).toEqual([]);
    expect(classesOn("2026-09-18", tt)).toEqual([]); // Friday
  });
  it("counts coverage over a range and lists the missing days", () => {
    const logs = [
      { log_date: "2026-09-13", subject_name: "Math", note: "Fractions", homework_given: true },
      { log_date: "2026-09-14", subject_name: "Math", note: "Decimals", homework_given: null },
    ];
    const c = classLogCoverage("2026-09-13", "2026-09-15", tt, logs);
    expect(c.due).toBe(4);
    expect(c.done).toBe(1);
    expect(c.days.map((d) => d.date)).toEqual(["2026-09-14", "2026-09-15"]);
    expect(c.days[0].missing).toEqual(["Math", "Science"]);
    expect(c.lastMissingDate).toBe("2026-09-15");
    expect(missingLine(c.days)).toBe("Mon: Math, Science · Tue: Arabic");
  });
  it("finds the next class of a subject for the homework due date", () => {
    expect(nextClassDate("Math", tt, "2026-09-13")).toBe("2026-09-14");
    expect(nextClassDate("Math", tt, "2026-09-14")).toBe("2026-09-17");
    expect(nextClassDate("math", tt, "2026-09-17")).toBe("2026-09-20");
    expect(nextClassDate("Chemistry", tt, "2026-09-13")).toBe("2026-09-14"); // not on the timetable: tomorrow
  });
});
