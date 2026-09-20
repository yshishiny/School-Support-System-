import { describe, expect, it } from "vitest";
import { balances, budgetSplit, claimTotals, claimable, monthSummary, statement, statementDesc, weeksToGoal, type WalletEntry } from "./wallet";

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

describe("claiming money back", () => {
  it("only offers the claim on his own spending, and not twice", () => {
    expect(claimable({ kind: "spend", claim_status: null })).toBe(true);
    expect(claimable({ kind: "spend", claim_status: "none" })).toBe(true);
    expect(claimable({ kind: "spend", claim_status: "rejected" })).toBe(true); // he may ask again with a better reason
    expect(claimable({ kind: "spend", claim_status: "requested" })).toBe(false);
    expect(claimable({ kind: "spend", claim_status: "approved" })).toBe(false);
    expect(claimable({ kind: "earn", claim_status: null })).toBe(false);
    expect(claimable({ kind: "withdraw", claim_status: null })).toBe(false);
  });

  it("adds up what is waiting and what was agreed", () => {
    const es = [
      { ...e("spend", 60, "2026-09-06", "Bread", "food"), claim_status: "requested" as const },
      { ...e("spend", 40, "2026-09-07", "Printing", "school"), claim_status: "requested" as const },
      { ...e("spend", 25, "2026-09-08", "Taxi", "other"), claim_status: "approved" as const },
      { ...e("spend", 90, "2026-09-09", "Game", "fun"), claim_status: "rejected" as const },
      e("spend", 15, "2026-09-10", "Sweets", "food"),
    ];
    expect(claimTotals(es)).toEqual({ requested: 100, approved: 25, count: 2 });
  });

  it("a wallet with no claims totals nothing", () => {
    expect(claimTotals([e("spend", 10, "2026-09-01")])).toEqual({ requested: 0, approved: 0, count: 0 });
  });
});

describe("the statement, as a balance sheet that must agree", () => {
  const round = (n: number) => Math.round(n * 100) / 100;

  const week = [
    e("earn", 100, "2026-09-01", "Allowance week"),
    e("earn", 60, "2026-09-08", "Allowance week"),
    e("withdraw", 40, "2026-09-09", "Dad handed it over"),
    e("spend", 15, "2026-09-10", "Sandwich"),
    e("adjust", 20, "2026-09-11", "Eid money"),
    e("withdraw", 25, "2026-09-12", "Dad handed it over"),
    e("spend", 10, "2026-09-13", "Pens"),
  ];

  it("money arriving lifts the total and sits with Dad until he hands it over", () => {
    const [first] = statement(week);
    expect(first.kind).toBe("in");
    expect(first.withDad).toBe(100);
    expect(first.inPocket).toBe(0);
    expect(first.total).toBe(100);
  });

  it("a hand-over moves money without changing the total — the line that used to confuse", () => {
    const rows = statement(week);
    const before = rows[1];
    const handover = rows[2];
    expect(handover.kind).toBe("moved");
    expect(handover.delta).toBe(0);
    expect(handover.total).toBe(before.total);
    expect(handover.withDad).toBe(before.withDad - 40);
    expect(handover.inPocket).toBe(before.inPocket + 40);
  });

  it("spending comes off the pocket and lowers the total", () => {
    const rows = statement(week);
    const spend = rows[3];
    expect(spend.kind).toBe("out");
    expect(spend.delta).toBe(-15);
    expect(spend.inPocket).toBe(25);
    expect(spend.total).toBe(rows[2].total - 15);
  });

  it("the two sides always add up to the total, on every single line", () => {
    for (const r of statement(week)) expect(round(r.withDad + r.inPocket)).toBe(r.total);
  });

  it("the last line agrees with the totals at the top of the page", () => {
    const rows = statement(week);
    const last = rows[rows.length - 1];
    const b = balances(week);
    expect(last.withDad).toBe(b.withDad);
    expect(last.inPocket).toBe(b.inPocket);
    expect(last.total).toBe(b.net);
  });

  it("earned minus spent is the total, which is what a balance sheet means", () => {
    const b = balances(week);
    expect(round(b.earned + b.adjusted - b.spent)).toBe(b.net);
    expect(round(b.withDad + b.inPocket)).toBe(b.net);
  });

  it("a parent taking something back reads as money out, not as an arrival", () => {
    const rows = statement([e("earn", 50, "2026-09-01"), e("adjust", -20, "2026-09-02", "Broke the window")]);
    expect(rows[1].kind).toBe("out");
    expect(rows[1].total).toBe(30);
  });

  it("reads oldest first, and newest first when asked", () => {
    expect(statement(week)[0].entry.occurred_on).toBe("2026-09-01");
    expect(statementDesc(week)[0].entry.occurred_on).toBe("2026-09-13");
  });

  it("is empty for a wallet nobody has used", () => {
    expect(statement([])).toEqual([]);
  });
});
