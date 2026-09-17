import { describe, expect, it } from "vitest";
import { materialStages, materialsKpi, nextStage } from "./study";

describe("school file study loop", () => {
  it("spaces three sets and marks them done, due, overdue or later", () => {
    const s = materialStages("2026-09-10", ["2026-09-11"], "2026-09-15");
    expect(s.map((x) => x.state)).toEqual(["done", "due", "later"]);
    expect(s[1].dueBy).toBe("2026-09-17");
    expect(nextStage(s)?.n).toBe(2);
    const late = materialStages("2026-09-01", [], "2026-09-20");
    expect(late.map((x) => x.state)).toEqual(["overdue", "overdue", "overdue"]);
    expect(nextStage(materialStages("2026-09-10", ["2026-09-11", "2026-09-14", "2026-09-20"], "2026-09-25"))).toBeNull();
  });
  it("counts only deadlines inside the allowance week, on time", () => {
    const r = materialsKpi([{ id: "a", uploadedOn: "2026-09-10" }, { id: "b", uploadedOn: "2026-09-01" }], [{ materialId: "a", date: "2026-09-12" }, { materialId: "b", date: "2026-09-02" }], "2026-09-12", "2026-09-18");
    // a: stage1 due 13 (done 12 ✓), stage2 due 17 (no second set ✗); b: stage3 due 15 (only one set ✗)
    expect(r).toEqual({ due: 3, done: 1 });
  });
});
