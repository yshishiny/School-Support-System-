import { describe, expect, it } from "vitest";
import { owed, timeline, verdict, weekIsEmpty, type ClosedWeek, type DayEvidence, type PointEntry } from "./trace";
import type { WalletEntry } from "./wallet";

const w = (id: string, kind: WalletEntry["kind"], amount: number, on: string, label: string): WalletEntry =>
  ({ id, kind, amount_egp: amount, label, category: null, occurred_on: on });

const p = (delta: number, reason: string, created_at: string): PointEntry => ({ delta, reason, created_at, ref_type: null });

const week = (id: string, start: string, amount: number, paid: string | null): ClosedWeek =>
  ({ id, week_start: start, week_end: start, score: 51, band: "some", amount, paid_at: paid, claimed_at: null });

describe("timeline", () => {
  it("puts points and money in one list, newest first", () => {
    const t = timeline(
      [p(10, "Check-in", "2026-09-18T19:10:00Z"), p(-200, "Redeemed: 500 EGP", "2026-09-21T04:00:00Z")],
      [w("a", "earn", 100, "2026-09-19", "Allowance week")],
    );
    expect(t.map((x) => x.what)).toEqual(["Redeemed: 500 EGP", "Allowance week", "Check-in"]);
  });

  it("signs money the way the held balance moves", () => {
    const t = timeline([], [w("a", "earn", 100, "2026-09-19", "in"), w("b", "withdraw", 40, "2026-09-20", "handed over")]);
    expect(t.find((x) => x.what === "in")!.egp).toBe(100);
    expect(t.find((x) => x.what === "handed over")!.egp).toBe(-40);
  });

  it("keeps the time of day on a points entry and leaves it off a wallet one", () => {
    const t = timeline([p(5, "Quiz", "2026-09-20T19:07:53Z")], [w("a", "earn", 10, "2026-09-20", "x")]);
    expect(t.find((x) => x.kind === "points")!.at).toBe("19:07");
    expect(t.find((x) => x.kind === "money")!.at).toBeNull();
  });

  it("is empty for a child with no history", () => expect(timeline([], [])).toEqual([]));
});

describe("owed", () => {
  it("separates money already recorded from weeks never marked paid", () => {
    const o = owed(100, [week("w1", "2026-09-12", 100, null), week("w2", "2026-09-05", 100, "2026-09-06T00:00:00Z")]);
    expect(o.handOver).toBe(100);
    expect(o.unpaidTotal).toBe(100);
    expect(o.unpaidWeeks).toHaveLength(1);
    expect(o.ifSettled).toBe(200);
  });

  it("ignores a closed week that scored nothing", () => {
    const o = owed(0, [week("w1", "2026-09-12", 0, null)]);
    expect(o.unpaidWeeks).toHaveLength(0);
    expect(o.ifSettled).toBe(0);
  });
});

describe("verdict", () => {
  it("names both halves when both exist", () => {
    // Youssef's actual position on the day this was written.
    expect(verdict(owed(100, [week("w1", "2026-09-12", 100, null)]), "Youssef")).toBe(
      "Youssef: 100 EGP already earned and waiting to be handed over, and 100 EGP from 1 closed week you have not marked paid.",
    );
  });
  it("says so plainly when nothing is owed", () => {
    expect(verdict(owed(0, []), "Khadija")).toBe("Nothing is owed to Khadija right now.");
  });
});

describe("weekIsEmpty", () => {
  const blank = (date: string): DayEvidence => ({ date, checkedIn: false, prayers: 0, classesLogged: 0, quizzesDone: 0, snaps: 0, pointsEarned: 0 });
  it("is true when nothing at all was recorded", () => {
    expect(weekIsEmpty([blank("2026-09-12"), blank("2026-09-13")])).toBe(true);
  });
  it("is false on a single prayer", () => {
    expect(weekIsEmpty([blank("2026-09-12"), { ...blank("2026-09-13"), prayers: 1 }])).toBe(false);
  });
});
