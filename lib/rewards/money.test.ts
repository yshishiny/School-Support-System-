import { describe, expect, it } from "vitest";
import { mismatchLine, moneyInTitle, payoutOf, titleMoneyMismatch } from "./money";

describe("moneyInTitle", () => {
  it("reads a bare figure", () => expect(moneyInTitle("500 EGP")).toEqual([500]));
  it("reads a figure in brackets", () => expect(moneyInTitle("Savings match (100 EGP)")).toEqual([100]));
  it("reads thousands separators", () => expect(moneyInTitle("1,500 EGP")).toEqual([1500]));
  it("reads LE and the Arabic word", () => {
    expect(moneyInTitle("250 LE")).toEqual([250]);
    expect(moneyInTitle("٣٠٠ - 300 جنيه")).toEqual([300]);
  });
  it("ignores numbers that are not money", () => {
    expect(moneyInTitle("2h extra gaming")).toEqual([]);
    expect(moneyInTitle("45 minutes later on a weekend night")).toEqual([]);
    expect(moneyInTitle("Cinema Tickets")).toEqual([]);
  });
});

describe("titleMoneyMismatch", () => {
  it("catches the reward that started this", () => {
    expect(titleMoneyMismatch("500 EGP", "100.00")).toEqual({ claimed: 500, actual: 100 });
  });
  it("is silent when the title tells the truth", () => {
    expect(titleMoneyMismatch("Savings match (100 EGP)", 100)).toBeNull();
    expect(titleMoneyMismatch("Sadaqah in his name (100 EGP)", "100.00")).toBeNull();
  });
  it("is silent for a reward that never mentions money", () => {
    expect(titleMoneyMismatch("New boots or kit item", null)).toBeNull();
    expect(titleMoneyMismatch("Pick the family movie", null)).toBeNull();
  });
  it("catches a title promising money from a reward that pays none", () => {
    expect(titleMoneyMismatch("200 EGP voucher", null)).toEqual({ claimed: 200, actual: 0 });
  });
  it("accepts a title that names the right figure among several", () => {
    expect(titleMoneyMismatch("100 EGP now or 300 EGP at the end", 300)).toBeNull();
  });
});

describe("mismatchLine", () => {
  it("names both numbers", () => {
    expect(mismatchLine("500 EGP", "100.00")).toBe("The title says 500 EGP but this reward pays 100 EGP.");
  });
  it("says plainly when nothing is paid", () => {
    expect(mismatchLine("200 EGP voucher", null)).toBe("The title says 200 EGP but this reward pays no money at all.");
  });
  it("returns nothing when they agree", () => expect(mismatchLine("Cinema Tickets", null)).toBeNull());
});

describe("payoutOf", () => {
  it("reads the numeric string Postgres returns", () => expect(payoutOf({ cash_amount_egp: "100.00" })).toBe(100));
  it("is zero for a reward that is not cash", () => {
    expect(payoutOf({ cash_amount_egp: null })).toBe(0);
    expect(payoutOf({})).toBe(0);
  });
});
