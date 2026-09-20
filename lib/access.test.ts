import { describe, expect, it } from "vitest";
import { CREDITS_PER_CHILD_DAY, CREDITS_PER_EGP, MAX_INVITES, REFERRAL_CREDITS, INVITES_CEILING, REFERRAL_BONUS_CREDITS, accessUntil, bonusDue, commissionFor, creditBalance, creditsFor, egpFor, grantWindow, hasAccess, inviteCode, invitesAllowed, planById, priceAfterWelcome, priceList, tierFor, daysOfAccessLeft, expiringAccess, type AccessGrant } from "./access";

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

describe("the ambassador ladder", () => {
  it("starts everyone as a parent, earning nothing on commission", () => {
    expect(tierFor(0).id).toBe("parent");
    expect(tierFor(4).id).toBe("parent");
    expect(commissionFor(4, 22_500)).toBe(0);
  });

  it("promotes at five paying families, and again at twenty", () => {
    expect(tierFor(5).id).toBe("ambassador");
    expect(tierFor(19).id).toBe("ambassador");
    expect(tierFor(20).id).toBe("partner");
    expect(tierFor(100).id).toBe("partner");
  });

  it("pays a fifth, then a quarter, of what those families spend", () => {
    expect(commissionFor(5, 22_500)).toBe(4_500);
    expect(commissionFor(20, 22_500)).toBe(5_625);
    expect(egpFor(commissionFor(20, 60_000))).toBe(300);
  });

  it("counts families that paid, not families that joined", () => {
    // Twenty joined but only four paid is still a parent.
    expect(tierFor(4).rate).toBe(0);
  });
});

describe("invitations grow with success", () => {
  it("gives two to begin with", () => {
    expect(invitesAllowed(0)).toBe(2);
  });
  it("adds two for each family that converted", () => {
    expect(invitesAllowed(1)).toBe(4);
    expect(invitesAllowed(5)).toBe(12);
  });
  it("stops somewhere, so nobody can flood the world", () => {
    expect(invitesAllowed(1000)).toBe(INVITES_CEILING);
    expect(invitesAllowed(-3)).toBe(2);
  });
});

describe("the double-sided referral", () => {
  it("takes a quarter off the newcomer's first purchase, once", () => {
    expect(priceAfterWelcome(22_500, false)).toBe(16_875);
    expect(egpFor(priceAfterWelcome(22_500, false))).toBe(338);
    expect(priceAfterWelcome(22_500, true)).toBe(22_500);
  });

  it("pays the inviter on the second purchase, not the first, and never twice", () => {
    expect(bonusDue(1, false)).toBe(false);
    expect(bonusDue(2, false)).toBe(true);
    expect(bonusDue(3, false)).toBe(true);
    expect(bonusDue(2, true)).toBe(false);
  });

  it("is worth a child-month to the inviter", () => {
    expect(REFERRAL_BONUS_CREDITS).toBe(planById("child_month")!.credits);
    expect(egpFor(REFERRAL_BONUS_CREDITS)).toBe(450);
  });
});

describe("warning a family before its month runs out", () => {
  const g = (studentId: string | null, starts: string, ends: string): AccessGrant =>
    ({ student_id: studentId, starts_on: starts, ends_on: ends, plan: "child_month" } as AccessGrant);

  const grants = [g("omar", "2026-09-01", "2026-09-26"), g("youssef", "2026-09-01", "2026-09-30")];

  it("counts the days that are left", () => {
    expect(daysOfAccessLeft(grants, "omar", "2026-09-20")).toBe(6);
    expect(daysOfAccessLeft(grants, "omar", "2026-09-26")).toBe(0);
    expect(daysOfAccessLeft(grants, "nobody", "2026-09-20")).toBeNull();
  });

  it("warns three days out, while there is still time to renew", () => {
    const due = expiringAccess(grants, ["omar", "youssef"], "2026-09-23");
    expect(due.map((d) => d.studentId)).toEqual(["omar"]);
    expect(due[0].daysLeft).toBe(3);
    expect(due[0].endsOn).toBe("2026-09-26");
  });

  it("warns again on the day it runs out", () => {
    expect(expiringAccess(grants, ["omar"], "2026-09-26").map((d) => d.daysLeft)).toEqual([0]);
  });

  it("stays quiet on every other night, so the warning is still read when it comes", () => {
    for (const day of ["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-24", "2026-09-25"]) {
      expect(expiringAccess(grants, ["omar"], day)).toEqual([]);
    }
  });

  it("says nothing about a child who never had access, or whose access already lapsed", () => {
    expect(expiringAccess(grants, ["nobody"], "2026-09-23")).toEqual([]);
    expect(expiringAccess(grants, ["omar"], "2026-09-28")).toEqual([]);
  });

  it("counts a whole-family grant as covering every child", () => {
    const family = [g(null, "2026-09-01", "2026-09-26")];
    expect(expiringAccess(family, ["omar", "youssef"], "2026-09-23").map((d) => d.studentId)).toEqual(["omar", "youssef"]);
  });
});
