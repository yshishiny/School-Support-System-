import { describe, it, expect } from "vitest";
import { buildDailyReport } from "./report";

describe("buildDailyReport", () => {
  it("flags a missing check-in and lists tasks", () => {
    const text = buildDailyReport("2026-09-14", [
      {
        name: "Youssef",
        grade: 10,
        checkin: {
          mood: 4,
          minutes: 90,
          learned: "Quadratic formula",
          stuckOn: null,
          items: [
            { title: "Math p.45", kind: "homework", status: "done" },
            { title: "Bio lab report", kind: "project", status: "partial" },
          ],
        },
        pointsToday: 15,
        balance: 120,
        streak: 3,
        dueTomorrow: [{ title: "English essay", kind: "homework" }],
        upcoming: [{ title: "Chemistry quiz", kind: "quiz", due_date: "2026-09-17" }],
        overdue: [],
        pendingRedemptions: [],
        practice: { sets: 2, correct: 13, total: 16, reviewsDue: 0, flags: ["Geometry set: Answered very fast"] },
        covered: [{ subject: "Math", note: "quadratic formula" }],
        prayers: [
          { prayer: "fajr", status: "on_time" },
          { prayer: "dhuhr", status: "on_time" },
          { prayer: "asr", status: "late" },
          { prayer: "maghrib", status: "on_time" },
        ],
      },
      {
        name: "Omar",
        grade: 8,
        checkin: null,
        pointsToday: 0,
        balance: 40,
        streak: 0,
        dueTomorrow: [],
        upcoming: [],
        overdue: [{ title: "Science worksheet", kind: "homework", due_date: "2026-09-12" }],
        pendingRedemptions: [{ title: "Pizza night", points: 100 }],
      },
    ]);
    expect(text).toContain("*Youssef* (Grade 10)");
    expect(text).toContain("1/2 tasks done");
    expect(text).toContain("💡 Learned: Quadratic formula");
    expect(text).toContain("*Omar* (Grade 8)");
    expect(text).toContain("No check-in today");
    expect(text).toContain("Overdue: Science worksheet");
    expect(text).toContain("Wants to redeem: Pizza night (100 pts)");
    expect(text).toContain("Practice: 2 sets, 13/16 correct (81%)");
    expect(text).toContain("Covered today: Math: quadratic formula");
    expect(text).toContain("Prayers: 3/5 on time · late: Asr · 1 not logged");
    expect(text).toContain("⚠️ Geometry set: Answered very fast");
  });
});
