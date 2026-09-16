import { describe, expect, it } from "vitest";
import { askedToday, custodianFor, custodyInUse, parentName } from "./custody";

const dad = "d", mum = "m";
// 2026-09-16 is a Wednesday (3); 2026-09-18 a Friday (5)
const pattern = { "0": dad, "1": dad, "2": dad, "3": mum, "4": mum, "5": null, "6": dad };

describe("custody", () => {
  it("uses the weekly pattern", () => {
    expect(custodianFor("2026-09-16", pattern)).toBe(mum);
    expect(custodianFor("2026-09-14", pattern)).toBe(dad);
    expect(custodianFor("2026-09-18", pattern)).toBeNull();
  });
  it("overrides win over the pattern", () => {
    expect(custodianFor("2026-09-16", pattern, [{ day: "2026-09-16", parent_id: dad }])).toBe(dad);
    expect(custodianFor("2026-09-16", pattern, [{ day: "2026-09-16", parent_id: null }])).toBeNull();
  });
  it("treats an empty pattern as shared", () => {
    expect(custodianFor("2026-09-16", {})).toBeNull();
    expect(custodianFor("2026-09-16", null)).toBeNull();
    expect(custodyInUse({})).toBe(false);
    expect(custodyInUse(pattern)).toBe(true);
  });
  it("asks everyone when shared, only the custodian otherwise", () => {
    expect(askedToday(dad, null)).toBe(true);
    expect(askedToday(dad, mum)).toBe(false);
    expect(askedToday(mum, mum)).toBe(true);
  });
  it("names parents by label then first name", () => {
    expect(parentName({ id: dad, full_name: "Yasser S", parent_label: "Baba" })).toBe("Baba");
    expect(parentName({ id: dad, full_name: "Yasser S", parent_label: null })).toBe("Yasser");
    expect(parentName(null)).toBe("both parents");
  });
});
