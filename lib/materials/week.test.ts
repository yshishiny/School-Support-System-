import { describe, expect, it } from "vitest";
import { decideWeek, schoolWeekStart } from "./week";

describe("week summary dates", () => {
  it("finds the Sunday of a school week", () => {
    expect(schoolWeekStart("2026-09-17")).toBe("2026-09-13");
    expect(schoolWeekStart("2026-09-13")).toBe("2026-09-13");
  });
  it("trusts dates in this or last week, flags a typo, and lets the parent override", () => {
    expect(decideWeek("2026-09-17", null, "2026-09-14", "2026-09-18")).toEqual({ coversWeekStart: "2026-09-13", note: null, mismatch: false });
    expect(decideWeek("2026-09-17", null, "2026-09-07", "2026-09-11").coversWeekStart).toBe("2026-09-06");
    const typo = decideWeek("2026-09-17", null, "2026-03-01", "2026-03-05");
    expect(typo.coversWeekStart).toBe("2026-09-13");
    expect(typo.mismatch).toBe(true);
    expect(typo.note).toMatch(/01\/03\/2026–05\/03\/2026/);
    const chosen = decideWeek("2026-09-17", "last", "2026-03-01", null);
    expect(chosen.coversWeekStart).toBe("2026-09-06");
    expect(chosen.note).toMatch(/kept as last week/);
    expect(decideWeek("2026-09-17", null, null, null).note).toMatch(/No dates found/);
  });
});
