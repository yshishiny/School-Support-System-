import { describe, expect, it } from "vitest";
import { ageOn, daysToBirthday, isBirthday, learnerLine } from "./people";

describe("people", () => {
  it("computes age with the birthday not yet passed", () => {
    expect(ageOn("2011-09-20", "2026-09-17")).toBe(14);
    expect(ageOn("2011-09-17", "2026-09-17")).toBe(15);
    expect(ageOn(null, "2026-09-17")).toBeNull();
  });
  it("finds birthdays and the countdown", () => {
    expect(isBirthday("2011-09-17", "2026-09-17")).toBe(true);
    expect(daysToBirthday("2011-09-20", "2026-09-17")).toBe(3);
    expect(daysToBirthday("2011-01-05", "2026-09-17")).toBe(110);
    expect(daysToBirthday("2011-09-17", "2026-09-17")).toBe(0);
  });
  it("describes the learner", () => {
    expect(learnerLine({ full_name: "Youssef Yasser", grade: 10, stage: "school", birth_date: "2011-03-01" }, "2026-09-17")).toBe("Youssef, 15 years old, school grade 10");
    expect(learnerLine({ full_name: "Sara", grade: null, stage: "postgraduate" }, "2026-09-17")).toBe("Sara, postgraduate");
  });
});
