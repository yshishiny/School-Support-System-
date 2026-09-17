import { describe, expect, it } from "vitest";
import { integritySignals, type IntegrityInput } from "./integrity";

const base: IntegrityInput = { today: "2026-09-16", attempts: [], prayers: [], checkins: [], lessonLogs: [], snaps: [] };

describe("integrity signals", () => {
  it("is quiet on a normal week", () => {
    expect(integritySignals({ ...base, attempts: [{ submitted_at: "x", seconds: 200, total: 8, tab_switches: 0, kind: "quiz" }] })).toEqual([]);
  });
  it("flags a quiz done too fast and tab switching", () => {
    const s = integritySignals({ ...base, attempts: [{ submitted_at: "x", seconds: 30, total: 8, tab_switches: 4, kind: "quiz", title: "Fractions" }] });
    expect(s.map((x) => x.code)).toEqual(["fast_quiz", "tab_switches"]);
    expect(s[0].ask).toContain("Fractions");
  });
  it("flags three prayers logged within minutes, but not honest late entries", () => {
    const p = (prayer: string, t: string, late = false) => ({ log_date: "2026-09-15", logged_at: `2026-09-15T${t}:00Z`, status: "on_time", entered_late: late, claim: null, prayer });
    expect(integritySignals({ ...base, prayers: [p("fajr", "20:00"), p("dhuhr", "20:01"), p("asr", "20:02")] }).map((x) => x.code)).toEqual(["prayer_burst"]);
    // Honest late entries are never a burst; "late" and "missed" claims never count as after-the-fact on-time claims.
    expect(integritySignals({ ...base, prayers: [{ ...p("fajr", "20:00", true), status: "late" }, { ...p("dhuhr", "20:01", true), status: "missed" }, { ...p("asr", "20:02", true), status: "late" }] })).toEqual([]);
  });
  it("flags repeated after-the-fact on-time claims outside school", () => {
    const p = (prayer: string, d: string) => ({ log_date: d, logged_at: `${d}T21:00:00Z`, status: "on_time", entered_late: true, claim: "other", prayer });
    expect(integritySignals({ ...base, prayers: [p("isha", "2026-09-13"), p("maghrib", "2026-09-14"), p("fajr", "2026-09-15")] })[0].code).toBe("retro_on_time");
    const school = integritySignals({ ...base, prayers: [p("dhuhr", "2026-09-13"), p("asr", "2026-09-14"), p("dhuhr", "2026-09-15")].map((x) => ({ ...x, claim: "school" })) });
    expect(school).toEqual([]);
  });
  it("flags copied class notes and night check-ins", () => {
    const s = integritySignals({ ...base, lessonLogs: [{ log_date: "2026-09-14", subject_name: "Math", note: "Linear equations" }, { log_date: "2026-09-15", subject_name: "Math", note: "linear equations " }], checkins: [{ checkin_date: "2026-09-15", submitted_at: "x", hourLocal: 1 }] });
    expect(s.map((x) => x.code).sort()).toEqual(["copy_notes", "night_checkin"]);
  });
  it("flags 'No class' used three times in a day", () => {
    const logs = ["Physics", "Biology", "English"].map((sub) => ({ log_date: "2026-09-16", subject_name: sub, note: "No class / absent" }));
    const s = integritySignals({ ...base, lessonLogs: logs });
    expect(s[0].code).toBe("no_class_overuse");
    expect(s[0].ask).toContain("Physics, Biology, English");
    expect(integritySignals({ ...base, lessonLogs: logs.slice(0, 2) })).toEqual([]);
  });
});

describe("school file vs class log", () => {
  const base = { today: "2026-09-18", attempts: [], prayers: [], checkins: [], snaps: [], timetableSubjects: [{ weekday: 0, subject_name: "English (GPA)" }, { weekday: 2, subject_name: "English (GPA)" }] };
  const file = { subject: "English (GPA)", title: "Grade 10 Quarter 1 Literature", topics: ["Of Mice and Men", "Foreshadowing", "Character arc"], created_at: "2026-09-18T10:00:00Z", uploaded_by_student: false };
  it("flags a file for a subject he marked 'no class'", () => {
    const out = integritySignals({ ...base, lessonLogs: [{ log_date: "2026-09-15", subject_name: "English (GPA)", note: "No class" }], materials: [file] });
    const sig = out.find((x) => x.code === "log_vs_school");
    expect(sig?.label).toMatch(/1 of his English \(GPA\) classes marked/);
    expect(sig?.ask).toMatch(/Of Mice and Men/);
  });
  it("flags notes that never mention the file's topics, and stays quiet when they do", () => {
    const off = integritySignals({ ...base, lessonLogs: [{ log_date: "2026-09-15", subject_name: "English (GPA)", note: "grammar drills" }], materials: [file] });
    expect(off.find((x) => x.code === "log_vs_school")?.label).toMatch(/do not mention/);
    const ok = integritySignals({ ...base, lessonLogs: [{ log_date: "2026-09-15", subject_name: "English (GPA)", note: "Of Mice and Men chapter 2, foreshadowing" }], materials: [file] });
    expect(ok.find((x) => x.code === "log_vs_school")).toBeUndefined();
  });
});

describe("weekly syllabus vs class log", () => {
  it("compares every subject the syllabus lists with that week's log", () => {
    const out = integritySignals({
      today: "2026-09-17", attempts: [], prayers: [], checkins: [], snaps: [],
      timetableSubjects: [{ weekday: 0, subject_name: "Math (GPA)" }, { weekday: 1, subject_name: "English (GPA)" }, { weekday: 2, subject_name: "Physics" }],
      lessonLogs: [{ log_date: "2026-09-14", subject_name: "Math (GPA)", note: "multi-step equations" }, { log_date: "2026-09-15", subject_name: "English (GPA)", note: "No class / absent" }],
      materials: [{ subject: null, title: "Grade 10 Weekly Syllabus", topics: [], created_at: "2026-09-17T10:00:00Z", uploaded_by_student: false, is_week_summary: true, covers_week_start: "2026-09-13", subjects: [{ subject: "Math", topics: ["Solving multi-step equations"] }, { subject: "English", topics: ["Parts of speech"] }, { subject: "Physics", topics: ["Atomic structure"] }, { subject: "French", topics: ["Verbs"] }] }],
    });
    const sig = out.find((x) => x.code === "syllabus_vs_log");
    expect(sig?.label).toMatch(/2 subjects/);
    expect(sig?.ask).toMatch(/English: “no class” ×1/);
    expect(sig?.ask).toMatch(/Physics: nothing logged/);
    expect(sig?.ask).not.toMatch(/Math/);
    expect(sig?.ask).not.toMatch(/French/);
  });
});

describe("screen time", () => {
  it("flags days over the family limit from the evening screenshot", () => {
    const out = integritySignals({ today: "2026-09-17", attempts: [], prayers: [], checkins: [], lessonLogs: [], screenLimit: 180, snaps: [
      { taken_on: "2026-09-15", status: "approved", ai_verdict: "looks_good", kind: "screentime", ai_detail: { total_minutes: 250, top_apps: [{ app: "TikTok", minutes: 120 }, { app: "YouTube", minutes: 60 }] } },
      { taken_on: "2026-09-16", status: "pending", ai_verdict: "looks_good", kind: "screentime", ai_detail: { total_minutes: 100 } },
    ] });
    const sig = out.find((x) => x.code === "screen_over_limit");
    expect(sig?.label).toMatch(/over the 3h limit on 1 day/);
    expect(sig?.ask).toMatch(/TikTok 120m/);
  });
});
