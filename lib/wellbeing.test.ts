import { describe, expect, it } from "vitest";
import { dueInstruments, scoreInstrument, wellbeingStatus } from "./wellbeing";

describe("scoreInstrument", () => {
  it("scores WHO-5 as raw × 4 with the standard cut-offs", () => {
    expect(scoreInstrument("who5", { w1: "5", w2: "5", w3: "5", w4: "5", w5: "5" })).toEqual({ score: 100, band: "green" });
    expect(scoreInstrument("who5", { w1: "2", w2: "2", w3: "3", w4: "2", w5: "3" })).toEqual({ score: 48, band: "amber" });
    expect(scoreInstrument("who5", { w1: "1", w2: "1", w3: "2", w4: "1", w5: "2" })).toEqual({ score: 28, band: "red" });
  });
  it("reverse-scores stress in the pulse", () => {
    const good = scoreInstrument("pulse", { mood: "5", stress: "1", sleep: "5", energy: "5" });
    const bad = scoreInstrument("pulse", { mood: "1", stress: "5", sleep: "1", energy: "1" });
    expect(good.score).toBe(100);
    expect(bad.score).toBe(0);
    expect(bad.band).toBe("red");
  });
});

describe("dueInstruments", () => {
  it("asks for everything at the start, then only what is due", () => {
    expect(dueInstruments("2026-09-15", [])).toEqual(["pulse", "who5", "mindset", "habits", "straight"]);
    const history = [
      { instrument: "pulse" as const, taken_on: "2026-09-12", band: "green" as const, score: 80 },
      { instrument: "who5" as const, taken_on: "2026-09-01", band: "green" as const, score: 72 },
      { instrument: "mindset" as const, taken_on: "2026-08-01", band: "green" as const, score: 70 },
      { instrument: "habits" as const, taken_on: "2026-09-10", band: "green" as const, score: 70 },
      { instrument: "straight" as const, taken_on: "2026-09-13", band: "green" as const, score: 100 },
    ];
    expect(dueInstruments("2026-09-15", history)).toEqual(["mindset"]);
    expect(dueInstruments("2026-09-19", history)).toEqual(["pulse", "mindset"]);
    expect(dueInstruments("2026-09-20", history)).toEqual(["pulse", "mindset", "straight"]);
  });
});

describe("wellbeingStatus", () => {
  it("is red on a red WHO-5 or two red pulses, never exposing answers", () => {
    const s = wellbeingStatus([{ instrument: "who5", taken_on: "2026-09-10", band: "red", score: 20 }], "2026-09-15");
    expect(s.band).toBe("red");
    const t = wellbeingStatus([
      { instrument: "pulse", taken_on: "2026-09-08", band: "red", score: 10 },
      { instrument: "pulse", taken_on: "2026-09-15", band: "red", score: 20 },
    ], "2026-09-15");
    expect(t.band).toBe("red");
    expect(wellbeingStatus([], "2026-09-15").band).toBeNull();
  });
});
