import { describe, expect, it } from "vitest";
import { curriculumSubject, pickTopic, planSlots } from "./plan";

const g10 = ["Math", "English", "Biology", "Physics", "Social Studies", "Arabic", "Religion", "Arabic Social Studies"];
const g8 = ["Math", "English", "Science", "Social Studies", "Arabic", "Religion", "Arabic Social Studies"];

describe("curriculumSubject", () => {
  it("maps timetable names to curriculum subjects", () => {
    expect(curriculumSubject("Math (GPA)", g10)).toBe("Math");
    expect(curriculumSubject("English Pre-SAT", g10)).toBe("English");
    expect(curriculumSubject("History", g10)).toBe("Social Studies");
    expect(curriculumSubject("Social English", g8)).toBe("Social Studies");
    expect(curriculumSubject("Science", g8)).toBe("Science");
  });
  it("maps the Ministry subjects taught in Arabic", () => {
    expect(curriculumSubject("Arabic", g10)).toBe("Arabic");
    expect(curriculumSubject("Arabic Social Studies", g10)).toBe("Arabic Social Studies");
    expect(curriculumSubject("Social Studies (M.O.E.)", g8)).toBe("Arabic Social Studies");
    expect(curriculumSubject("Religion", g8)).toBe("Religion");
  });
  it("skips foreign languages, P.E., art and music", () => {
    for (const n of ["French / German", "P.E.", "Art", "Music"]) {
      expect(curriculumSubject(n, g10)).toBeNull();
    }
  });
  it("falls back between Science and the split sciences", () => {
    expect(curriculumSubject("Science", g10)).toBe("Biology");
    expect(curriculumSubject("Physics", g8)).toBe("Science");
  });
});

const topics = [
  { id: "m1", subject: "Math", name: "Linear equations", sort: 1 },
  { id: "m2", subject: "Math", name: "Quadratics", sort: 2 },
  { id: "e1", subject: "English", name: "Theme", sort: 1 },
  { id: "s1", subject: "Science", name: "Cells", sort: 1 },
  { id: "s2", subject: "Science", name: "Forces", sort: 2 },
];

describe("pickTopic", () => {
  it("prefers the weakest practised topic under 70%", () => {
    const mastery = new Map([["m1", 90], ["m2", 40]]);
    expect(pickTopic(topics, "Math", mastery, new Set())?.id).toBe("m2");
  });
  it("schedules a coach-named foundation topic before anything else", () => {
    expect(pickTopic(topics, "Math", new Map([["m1", 40]]), new Set(), new Set(["m1"]), new Set(["m2"]))?.id).toBe("m2");
  });
  it("prefers a topic the student logged as taken at school, unless already mastered", () => {
    expect(pickTopic(topics, "Math", new Map(), new Set(), new Set(["m2"]))?.id).toBe("m2");
    expect(pickTopic(topics, "Math", new Map([["m2", 90]]), new Set(), new Set(["m2"]))?.id).toBe("m1");
  });
  it("then the first unpractised topic, skipping excluded ones", () => {
    expect(pickTopic(topics, "Math", new Map(), new Set(["m1"]))?.id).toBe("m2");
  });
});

// 2026-09-15 is a Tuesday. Egyptian school week: Sunday to Thursday.
const timetable = [
  { weekday: 0, subject_name: "Science" },
  { weekday: 1, subject_name: "Math" },
  { weekday: 2, subject_name: "English" },
  { weekday: 2, subject_name: "Math" },
  { weekday: 3, subject_name: "Science" },
  { weekday: 4, subject_name: "Math" },
];

describe("planSlots", () => {
  it("plans one school quiz per school day and no exam sets for a grade 8 student", () => {
    const { wanted, missing } = planSlots({ today: "2026-09-15", timetable, topics, exams: [], mastery: new Map(), existing: [] });
    expect(wanted.map((w) => w.date)).toEqual(["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-20", "2026-09-21"]);
    expect(wanted.every((w) => w.slot === "school")).toBe(true);
    expect(missing).toHaveLength(5);
  });
  it("adds an Arabic quiz every school day once Arabic topics exist, rotating the three Ministry subjects", () => {
    const arabicTopics = [
      { id: "a1", subject: "Arabic", name: "الحال", sort: 1 },
      { id: "r1", subject: "Religion", name: "الصلاة", sort: 1 },
      { id: "ss1", subject: "Arabic Social Studies", name: "الفتح الإسلامي", sort: 1 },
    ];
    const tt = [...timetable, { weekday: 2, subject_name: "Religion" }];
    const { wanted } = planSlots({ today: "2026-09-15", timetable: tt, topics: [...topics, ...arabicTopics], exams: [], mastery: new Map(), existing: [] });
    const arabic = wanted.filter((w) => w.slot === "arabic");
    expect(arabic).toHaveLength(5);
    expect(arabic[0].subject).toBe("Religion"); // taught on Tuesday
    expect(new Set(arabic.slice(0, 3).map((w) => w.subject)).size).toBe(3);
  });
  it("uses the coach's level for a subject and prefers a favourite subject on a tie", () => {
    const { wanted } = planSlots({ today: "2026-09-15", timetable, topics, exams: [], mastery: new Map(), existing: [], levels: { Math: "hard" }, favourites: ["Math"] });
    expect(wanted[0].subject).toBe("Math"); // Tuesday offers English and Math
    expect(wanted[0].difficulty).toBe("hard");
    expect(wanted[1].difficulty).toBe("medium");
  });
  it("spreads subjects across the week and never repeats a topic", () => {
    const { wanted } = planSlots({ today: "2026-09-15", timetable, topics, exams: [], mastery: new Map(), existing: [] });
    const ids = wanted.map((w) => w.topicId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(wanted[0].subject).toBe("English"); // Tuesday offers English and Math; English is first in the timetable
    expect(wanted[1].subject).toBe("Science");
  });
  it("adds a daily exam set in high school and skips slots that already exist", () => {
    const existing = [{ scheduled_for: "2026-09-15", plan_slot: "school", topic_id: "e1", act_section: null }];
    const { wanted, missing } = planSlots({ today: "2026-09-15", timetable, topics, exams: ["SAT", "ACT"], mastery: new Map(), existing });
    expect(wanted.filter((w) => w.slot === "exam")).toHaveLength(5);
    expect(missing.find((m) => m.date === "2026-09-15" && m.slot === "school")).toBeUndefined();
    expect(missing.find((m) => m.date === "2026-09-15" && m.slot === "exam")).toBeDefined();
    expect(missing.find((m) => m.topicId === "e1")).toBeUndefined();
    expect(wanted.find((w) => w.date === "2026-09-15" && w.slot === "school")?.topicId).toBe("e1");
  });
  it("uses only SAT sections when the target is the SAT", () => {
    const { wanted } = planSlots({ today: "2026-09-15", timetable, topics, exams: ["SAT"], mastery: new Map(), existing: [] });
    expect(wanted.filter((w) => w.slot === "exam").every((w) => w.actSection?.startsWith("sat_"))).toBe(true);
  });
});
