import { describe, expect, it } from "vitest";
import { lessonsLine, schoolDay } from "./school-day";

const tt = [
  { weekday: 3, subject_name: "Math", start_time: "09:30:00", end_time: "10:15:00" },
  { weekday: 3, subject_name: "English", start_time: "08:00:00", end_time: "08:45:00" },
  { weekday: 0, subject_name: "Arabic", start_time: "08:00:00", end_time: null },
];

describe("schoolDay", () => {
  it("lists lessons in time order on a school day", () => {
    const d = schoolDay("2026-09-16", tt); // Wednesday
    expect(d.off).toBe(false);
    expect(d.lessons.map((l) => l.subject_name)).toEqual(["English", "Math"]);
    expect(lessonsLine(d.lessons)).toBe("08:00 English · 09:30 Math");
  });
  it("marks weekends, holidays and empty weekdays as off", () => {
    expect(schoolDay("2026-09-18", tt)).toMatchObject({ off: true, reason: "Weekend" }); // Friday
    expect(schoolDay("2026-09-15", tt)).toMatchObject({ off: true, reason: "No lessons in the timetable" }); // Tuesday
    expect(schoolDay("2026-09-16", tt, [{ day: "2026-09-16", label: "Sports day" }])).toMatchObject({ off: true, reason: "Holiday: Sports day" });
    expect(schoolDay("2026-09-16", [])).toMatchObject({ off: true, reason: "No timetable yet" });
  });
});
