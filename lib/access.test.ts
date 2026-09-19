import { describe, expect, it } from "vitest";
import {
  CREDITS_PER_CHILD_DAY, CREDITS_PER_EGP, MAX_INVITES, REFERRAL_CREDITS,
  accessUntil, creditBalance, creditsFor, egpFor, grantWindow, hasAccess, inviteCode, planById, priceList,
} from "./access";

describe("the price list holds together", () => {
  it("keeps the owner's two anchors: 1500 credits is two child-days, and a child-month is 450 EGP", () => {
    expect(planById("child_2days")!.credits).toBe(1500);
    expect(planById("child_2days")!.credits / 2).toBe(CREDITS_PER_CHILD_DAY);
    expect(egpFor(planById("child_month")!.credits)).toBe(450);
  });

  it("charges the same per day for every plan that covers one child", () => {
    for (const id of ["child_2days", "child_week", "child_month"] as const) {
      const p = planById(id)!;
      expect(p.credits / p.days, id).toBe(CREDITS_PER_CHILD_DAY);
    }
  });

  it("makes the family plan cheaper than buying three children separately", () => {
    const child = planById("child_month")!.credits;
    const family = planById("family_month")!.credits;
    expect(family).toBeLessThan(child * 3);
    expect(family).toBeGreaterThan(child * 2);
  });

  it("makes a term cheaper by the month than four single months", () => {
    const perMonth = planById("family_term")!.credits / 4;
    expect(perMonth).toBeLessThan(planById("family_month")!.credits);
  });

  it("converts both ways without drifting", () => {
    expect(creditsFor(450)).toBe(22500);
    expect(egpFor(22500)).toBe(450);
    expect(egpFor(creditsFor(137))).toBe(137);
    expect(CREDITS_PER_EGP).toBe(50);
  });

  it("shows what a child plan works out at per month", () => {
    const week = priceList().find((p) => p.plan.id === "child_week")!;
    expect(week.perChildPerMonth).toBe(450);
    expect(priceList().find((p) => p.plan.id === "family_month")!.perChildPerMonth).toBeNull();
  });
});

describe("credits", () => {
  it("adds grants, referrals and spending into one balance", () => {
    expect(creditBalance([
      { delta: 1500, kind: "grant" },
      { delta: REFERRAL_CREDITS, kind: "referral" },
      { delta: -1500, kind: "spend" },
    ])).toBe(500);
    expect(creditBalance([])).toBe(0);
  });

  it("allows two invited families, each worth 500", () => {
    expect(MAX_INVITES).toBe(2);
    expect(creditBalance(Array.from({ length: MAX_INVITES }, () => ({ delta: REFERRAL_CREDITS, kind: "referral" as const })))).toBe(1000);
  });
});

describe("who may use the teacher", () => {
  const grants = [
    { student_id: "omar", starts_on: "2026-09-01", ends_on: "2026-09-30", plan: "child_month" },
    { student_id: null, starts_on: "2026-10-01", ends_on: "2026-10-31", plan: "family_month" },
  ];

  it("lets a child in on his own grant and on a family one", () => {
    expect(hasAccess(grants, "omar", "2026-09-15")).toBe(true);
    expect(hasAccess(grants, "youssef", "2026-09-15")).toBe(false);
    expect(hasAccess(grants, "youssef", "2026-10-15")).toBe(true);
  });

  it("closes on the day after the last one", () => {
    expect(hasAccess(grants, "omar", "2026-09-30")).toBe(true);
    expect(hasAccess(grants, "omar", "2026-10-31")).toBe(true);
    expect(hasAccess(grants, "omar", "2026-11-01")).toBe(false);
  });

  it("says when it runs out, taking the furthest grant", () => {
    expect(accessUntil(grants, "omar", "2026-09-15")).toBe("2026-10-31");
    expect(accessUntil(grants, "youssef", "2026-09-15")).toBe("2026-10-31");
    expect(accessUntil([], "omar", "2026-09-15")).toBeNull();
    expect(accessUntil(grants, "omar", "2026-12-01")).toBeNull();
  });
});

describe("buying again", () => {
  const month = planById("child_month")!;

  it("starts today when there is nothing live", () => {
    expect(grantWindow(month, "2026-09-19", null)).toEqual({ starts_on: "2026-09-19", ends_on: "2026-10-18" });
  });

  it("queues behind access that is still running, so paying early loses no days", () => {
    expect(grantWindow(month, "2026-09-19", "2026-09-30")).toEqual({ starts_on: "2026-10-01", ends_on: "2026-10-30" });
  });

  it("starts today again when the old one has already expired", () => {
    expect(grantWindow(month, "2026-09-19", "2026-09-01")).toEqual({ starts_on: "2026-09-19", ends_on: "2026-10-18" });
  });

  it("gives a two-day plan exactly two days", () => {
    const w = grantWindow(planById("child_2days")!, "2026-09-19", null);
    expect(w).toEqual({ starts_on: "2026-09-19", ends_on: "2026-09-20" });
  });
});

describe("invite codes", () => {
  it("are six characters from an alphabet with no lookalikes", () => {
    const code = inviteCode(() => 0.5);
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[ACDEFHJKMNPRTVWXY3479]{6}$/);
    expect(code).not.toMatch(/[OIL01258BGSZ]/);
  });
});
