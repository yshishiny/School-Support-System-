import { describe, expect, it } from "vitest";
import { buildMorning, isChampion, morningWindow } from "./morning";

describe("morning routine", () => {
  it("knows the night-before, the morning and the closed part of the day", () => {
    expect(morningWindow("21:00", "07:55")).toBe("night");
    expect(morningWindow("06:30", "07:55")).toBe("morning");
    expect(morningWindow("07:56", "07:55")).toBe("closed");
    expect(morningWindow("12:00", null)).toBe("closed");
  });
  it("lists only the tasks the family switched on and crowns a full morning", () => {
    const all = buildMorning({ fajrLogged: true, bedDone: true, sandwichDone: true, bagDone: true, ready: true, hasBedTask: true, hasSandwichTask: true, hasBagTask: true });
    expect(all.map((x) => x.code)).toEqual(["fajr", "bed", "sandwich", "bag", "ready"]);
    expect(isChampion(all)).toBe(true);
    const some = buildMorning({ fajrLogged: true, bedDone: false, sandwichDone: false, bagDone: false, ready: true, hasBedTask: true, hasSandwichTask: false, hasBagTask: false });
    expect(some.map((x) => x.code)).toEqual(["fajr", "bed", "ready"]);
    expect(isChampion(some)).toBe(false);
  });
});
