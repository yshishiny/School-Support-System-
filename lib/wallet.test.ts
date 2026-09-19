import { describe, expect, it } from "vitest";
import { balances, budgetSplit, monthSummary, weeksToGoal, type WalletEntry } from "./wallet";

const e = (kind: WalletEntry["kind"], amount: number, occurred_on: string, label = "x", category: string | null = null): WalletEntry =>
  ({ id: `${kind}-${occurred_on}-${amount}`, kind, amount_egp: amount, label, category, occurred_on });

describe("wallet balances", () => {
  it("keeps earned money with Dad until he hands it over", () => {
    const b = balances([e("earn", 250, "2026-09-04", "Allowance week")]);
    expect(b.withDad).toBe(250);
    expect(b.inPocket).toBe(0);
    expect(b.net).toBe(250);
  });

  it("moves a hand-over from held to pocket without changing what he owns", () => {
    const b = balances([e("earn", 250, "2026-09-04"), e("withdraw", 100, "2026-09-05")]);
    expect(b.withDad).toBe(150);
    expect(b.inPocket).toBe(100);
    expect(b.net).toBe(250);
  });

  it("spending only comes off the pocket, and off what he owns", () => {
    const b = balances([e("earn", 250, "2026-09-04"), e("withdraw", 100, "2026-09-05"), e("spend", 40, "2026-09-06")]);
    expect(b.withDad).toBe(150);
    expect(b.inPocket).toBe(60);
    expect(b.net).toBe(210);
  });

  it("an adjustment behaves like money earned", () => {
    const b = balances([e("earn", 100, "2026-09-01"), e("adjust", 25, "2026-09-02")]);
    expect(b.withDad).toBe(125);
    expect(b.net).toBe(125);
  });

  it("handles piastres without drifting", () => {
    const b = balances([e("earn", 10.1, "2026-09-01"), e("earn", 20.2, "2026-09-02"), e("withdraw", 30.3, "2026-09-03")]);
    expect(b.withDad).toBe(0);
    expect(b.inPocket).toBe(30.3);
  });
});

describe("the month on one page", () => {
  const entries = [
    e("earn", 250, "2026-09-04", "Allowance"),
    e("withdraw", 200, "2026-09-05", "Dad handed it over"),
    e("spend", 60, "2026-09-06", "Burger", "food"),
    e("spend", 100, "2026-09-10", "Game credit", "fun"),
    e("spend", 20, "2026-09-11", "Pens", "school"),
    e("spend", 500, "2026-08-11", "Old thing", "fun"),
  ];
  it("adds up the month and ranks where the money went", () => {
    const m = monthSummary(entries, "2026-09");
    expect(m.inEgp).toBe(250);
    expect(m.outEgp).toBe(180);
    expect(m.byCategory[0]).toMatchObject({ id: "fun", amount: 100, share: 56 });
    expect(m.byCategory.map((c) => c.id)).toEqual(["fun", "food", "school"]);
    expect(m.biggest).toEqual({ label: "Game credit", amount: 100 });
  });
  it("leaves other months out", () => {
    expect(monthSummary(entries, "2026-08").outEgp).toBe(500);
  });
  it("says nothing rather than dividing by zero in an empty month", () => {
    const m = monthSummary(entries, "2026-07");
    expect(m).toMatchObject({ inEgp: 0, outEgp: 0, byCategory: [], biggest: null });
  });
});

describe("learning to budget", () => {
  it("splits a payment into spend, save and give, losing nothing to rounding", () => {
    const s = budgetSplit(250);
    expect(s).toEqual({ spend: 150, save: 75, give: 25 });
    expect(s.spend + s.save + s.give).toBe(250);
  });
  it("still adds up on an awkward number", () => {
    const s = budgetSplit(137);
    expect(s.spend + s.save + s.give).toBe(137);
  });
  it("counts the weeks to a goal, and admits when there are none", () => {
    expect(weeksToGoal(1000, 200, 100)).toBe(8);
    expect(weeksToGoal(1000, 1200, 100)).toBe(0);
    expect(weeksToGoal(1000, 0, 0)).toBeNull();
  });
});
