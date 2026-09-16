import { describe, expect, it } from "vitest";
import { buildLessonDays, parseLessonFieldKey, suggestTopics } from "./lessons";

const math = [
  { id: "m1", name: "Linear equations", unit: null },
  { id: "m2", name: "Systems", unit: null },
  { id: "m3", name: "Quadratics", unit: null },
  { id: "m4", name: "Polynomials", unit: null },
  { id: "m5", name: "Radicals", unit: null },
];

describe("suggestTopics", () => {
  it("offers the first topics when nothing was logged yet", () => {
    expect(suggestTopics(math, [])).toEqual(["m1", "m2", "m3", "m4"]);
  });
  it("continues from the furthest logged topic and includes it", () => {
    expect(suggestTopics(math, ["m1", "m2"])).toEqual(["m2", "m3", "m4", "m5"]);
    expect(suggestTopics(math, ["m4"], 3)).toEqual(["m4", "m5", "m3"]);
  });
});

describe("buildLessonDays", () => {
  const topics = math.map((t, i) => ({ ...t, subject: "Math", sort: i }));
  // 2026-09-15 is a Tuesday; classes Sunday to Thursday.
  const timetable = [
    { weekday: 0, subject_name: "Math (GPA)" },
    { weekday: 1, subject_name: "Math (GPA)" },
    { weekday: 1, subject_name: "P.E." },
    { weekday: 2, subject_name: "Math SAT" },
  ];
  it("lists today and previous school days that still have a class without a note", () => {
    const days = buildLessonDays({ today: "2026-09-15", timetable, topics, logs: [] });
    expect(days.map((d) => d.label)).toEqual(["Today", "Yesterday", "Sun 13 Sep"]);
    expect(days[1].subjects.map((s) => s.subject)).toEqual(["Math (GPA)"]); // P.E. skipped
  });
  it("hides a previous day once every class has a note, and suggests the next topics", () => {
    const logs = [{ log_date: "2026-09-14", subject_name: "Math (GPA)", note: "Systems", topic_id: "m2", homework_given: false }];
    const days = buildLessonDays({ today: "2026-09-15", timetable, topics, logs });
    expect(days.map((d) => d.label)).toEqual(["Today", "Sun 13 Sep"]);
    expect(days[0].subjects[0].suggested).toEqual(["m2", "m3", "m4", "m5"]);
  });
  it("keeps a previous day visible while the homework question is unanswered, and skips days off", () => {
    const logs = [{ log_date: "2026-09-14", subject_name: "Math (GPA)", note: "Systems", topic_id: "m2", homework_given: null }];
    const days = buildLessonDays({ today: "2026-09-15", timetable, topics, logs, daysOff: ["2026-09-13"] });
    expect(days.map((d) => d.label)).toEqual(["Today", "Yesterday"]);
    expect(days[1].subjects[0].existingNote).toBe("Systems");
    expect(days[1].subjects[0].defaultHomeworkDue).toBe("2026-09-20"); // next Math (GPA): Sunday
  });
});

describe("parseLessonFieldKey", () => {
  it("reads dated keys and falls back to today", () => {
    expect(parseLessonFieldKey("2026-09-14__Math (GPA)", "2026-09-15")).toEqual({ date: "2026-09-14", subject: "Math (GPA)" });
    expect(parseLessonFieldKey("Physics", "2026-09-15")).toEqual({ date: "2026-09-15", subject: "Physics" });
  });
});
