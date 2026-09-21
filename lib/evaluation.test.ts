import { describe, expect, it } from "vitest";
import { evaluate, rate, RATING_RANK, type EvaluationInput } from "./evaluation";

const blank: EvaluationInput = {
  academic: { classesDue: 0, classesLogged: 0, quizzesPlanned: 0, quizzesAttempted: 0, homeworkDue: 0, homeworkOnTime: 0, recentQuizzes: 0, recentCorrect: 0, recentTotal: 0, gradeAverage: null, gradePrevious: null },
  manners: { daysTicked: 0, daysBad: 0, daysElapsed: 7, alerts: 0 },
  duties: { snapsDue: 0, snapsDone: 0, dishTicked: 0, dishBad: 0, phoneTicked: 0, phoneBad: 0, daysElapsed: 7 },
  faith: { daysElapsed: 7, daysWithFour: 0, logged: 0 },
  wellbeing: { band: null, signals: 0 },
  money: { points: 0, owedEgp: 0, requests: 0, blocked: false },
};
const dim = (e: ReturnType<typeof evaluate>, k: string) => e.dimensions.find((d) => d.key === k)!;

describe("rate", () => {
  it("never calls an absence of evidence good", () => expect(rate(null)).toBe("unknown"));
  it("grades a real share", () => {
    expect(rate(1)).toBe("strong");
    expect(rate(0.7)).toBe("steady");
    expect(rate(0.4)).toBe("slipping");
    expect(rate(0)).toBe("poor");
  });
});

describe("nothing measured is never fine", () => {
  it("rates an unjudged column unknown, not strong", () => {
    const e = evaluate(blank);
    expect(dim(e, "manners").rating).toBe("unknown");
    expect(dim(e, "academic").rating).toBe("unknown");
    expect(dim(e, "wellbeing").rating).toBe("unknown");
  });

  it("puts every blind spot in front of the parent rather than reporting a clean week", () => {
    const e = evaluate(blank);
    // Prayer is the one thing still measurable with nothing logged, so it is the only one that reads as poor;
    // the other four read unknown, and unknown belongs on the list a parent is asked to look at.
    expect(e.measured).toBe(1);
    expect(e.needsYou.map((d) => d.key)).toEqual(["faith", "academic", "manners", "duties", "wellbeing"]);
    expect(e.verdict).toContain("1 of 5 could be measured at all");
  });

  it("says outright when the week is too young to have seen anything", () => {
    const e = evaluate({ ...blank, faith: { daysElapsed: 0, daysWithFour: 0, logged: 0 }, manners: { ...blank.manners, daysElapsed: 0 } });
    expect(e.measured).toBe(0);
    expect(e.verdict).toContain("cannot see anything about him");
  });

  it("tells the parent that manners is theirs to measure", () => {
    expect(dim(evaluate(blank), "manners").headline).toContain("You have not judged a single day out of 7");
  });

  it("still measures prayer at zero, because a day with none logged is a fact", () => {
    const e = evaluate(blank);
    expect(dim(e, "faith").rating).toBe("poor");
    expect(dim(e, "faith").headline).toBe("Not one prayer logged in 7 days.");
  });
});

describe("academic", () => {
  it("averages the shares of what was actually due", () => {
    const e = evaluate({ ...blank, academic: { ...blank.academic, classesDue: 17, classesLogged: 13, quizzesPlanned: 6, quizzesAttempted: 4 } });
    // 13/17 = 0.76, 4/6 = 0.67 → 0.72
    expect(dim(e, "academic").rating).toBe("steady");
    expect(dim(e, "academic").evidence).toContain("13 of 17 classes written up");
  });

  it("ignores a measure with nothing due rather than scoring it full", () => {
    const e = evaluate({ ...blank, academic: { ...blank.academic, classesDue: 4, classesLogged: 0, homeworkDue: 0, homeworkOnTime: 0 } });
    expect(dim(e, "academic").rating).toBe("poor"); // 0/4, not (0/4 + 1) / 2
  });

  it("reports the direction the school average moved", () => {
    const up = evaluate({ ...blank, academic: { ...blank.academic, gradeAverage: 82, gradePrevious: 75 } });
    expect(dim(up, "academic").evidence).toContain("School average 82 (up from 75)");
    const down = evaluate({ ...blank, academic: { ...blank.academic, gradeAverage: 70, gradePrevious: 75 } });
    expect(dim(down, "academic").evidence).toContain("School average 70 (down from 75)");
  });
});

describe("home duties", () => {
  it("names the gate when not one chore was photographed", () => {
    const e = evaluate({ ...blank, duties: { ...blank.duties, snapsDue: 46, snapsDone: 0 } });
    expect(dim(e, "duties").rating).toBe("poor");
    expect(dim(e, "duties").headline).toContain("Not one of 46 chores photographed");
  });

  it("says outright which columns were never judged", () => {
    const ev = dim(evaluate(blank), "duties").evidence;
    expect(ev).toContain("Dish and space never judged");
    expect(ev).toContain("Phone parked never judged");
  });
});

describe("manners", () => {
  it("credits a clean run only over the days actually judged", () => {
    const e = evaluate({ ...blank, manners: { daysTicked: 2, daysBad: 0, daysElapsed: 7, alerts: 0 } });
    expect(dim(e, "manners").rating).toBe("strong");
    expect(dim(e, "manners").headline).toBe("Clean on all 2 days you judged.");
  });
  it("holds back a clean run when something was raised", () => {
    const e = evaluate({ ...blank, manners: { daysTicked: 7, daysBad: 0, daysElapsed: 7, alerts: 1 } });
    expect(dim(e, "manners").rating).toBe("steady");
  });
});

describe("wellbeing", () => {
  it("reads the traffic light and never the answers", () => {
    expect(dim(evaluate({ ...blank, wellbeing: { band: "red", signals: 3 } }), "wellbeing").rating).toBe("poor");
    expect(dim(evaluate({ ...blank, wellbeing: { band: "amber", signals: 0 } }), "wellbeing").rating).toBe("slipping");
    expect(dim(evaluate({ ...blank, wellbeing: { band: "green", signals: 0 } }), "wellbeing").rating).toBe("strong");
    expect(dim(evaluate({ ...blank, wellbeing: { band: "green", signals: 2 } }), "wellbeing").rating).toBe("steady");
  });
});

describe("money", () => {
  it("is a statement of fact, never a judgement of the child", () => {
    const e = evaluate({ ...blank, money: { points: 214, owedEgp: 200, requests: 1, blocked: true } });
    expect(dim(e, "money").rating).toBe("steady");
    expect(e.needsYou.map((d) => d.key)).not.toContain("money");
  });
  it("does not count towards how much could be measured", () => {
    // Money always has numbers. Counting it would turn "I can see one thing about him" into "I can see two".
    const rich = evaluate({ ...blank, money: { points: 214, owedEgp: 200, requests: 1, blocked: true } });
    expect(rich.measured).toBe(evaluate(blank).measured);
  });
});

describe("the verdict", () => {
  it("names what needs the parent, worst first", () => {
    const e = evaluate({
      ...blank,
      academic: { ...blank.academic, classesDue: 10, classesLogged: 7 },      // steady
      manners: { daysTicked: 7, daysBad: 4, daysElapsed: 7, alerts: 0 },      // poor-ish
      duties: { ...blank.duties, snapsDue: 10, snapsDone: 4 },                // slipping
      faith: { daysElapsed: 7, daysWithFour: 6, logged: 30 },                 // strong
      wellbeing: { band: "green", signals: 0 },
    });
    expect(e.needsYou[0].key).toBe("manners");
    expect(RATING_RANK[e.needsYou[0].rating]).toBeLessThanOrEqual(RATING_RANK[e.needsYou[1].rating]);
    expect(e.verdict).toContain("Worth your attention: manners");
  });

  it("says so when everything visible is fine", () => {
    const e = evaluate({
      ...blank,
      academic: { ...blank.academic, classesDue: 10, classesLogged: 10 },
      manners: { daysTicked: 7, daysBad: 0, daysElapsed: 7, alerts: 0 },
      duties: { ...blank.duties, snapsDue: 7, snapsDone: 7 },
      faith: { daysElapsed: 7, daysWithFour: 7, logged: 35 },
      wellbeing: { band: "green", signals: 0 },
    });
    expect(e.needsYou).toHaveLength(0);
    expect(e.verdict).toBe("Steady or better on all 5 of the 5 the app could see.");
  });

  it("counts only the dimensions it could actually see", () => {
    const e = evaluate({ ...blank, faith: { daysElapsed: 7, daysWithFour: 7, logged: 35 } });
    expect(e.measured).toBe(1);
    expect(e.verdict).toContain("1 of 5 could be measured at all");
  });
});
