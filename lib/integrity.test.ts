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
