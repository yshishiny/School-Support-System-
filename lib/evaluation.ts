/**
 * One judgement of a child, across every part of his life the app can see.
 *
 * A parent asking "how is he doing?" is not asking about a score out of a hundred. He is asking six questions
 * at once — is he learning, is he decent to people, is he pulling his weight at home, is he praying, is he all
 * right in himself, is he honest about money — and the app already holds the answer to all six in six different
 * places. This puts them in one list.
 *
 * The rule that governs the whole module: **nothing measured is "unknown", never "fine"**. That distinction is
 * the entire lesson of the week a child scored 37 having done nothing at all. A dimension with no evidence
 * behind it says so, and says it in the same tone as bad news, because for a parent it is bad news: it means he
 * cannot see.
 */

export type Rating = "strong" | "steady" | "slipping" | "poor" | "unknown";

export const RATING_LABEL: Record<Rating, string> = {
  strong: "Strong",
  steady: "Steady",
  slipping: "Slipping",
  poor: "Poor",
  unknown: "Nothing measured",
};

/** Ordered worst first, so "what needs me" is a sort rather than a special case. */
export const RATING_RANK: Record<Rating, number> = { poor: 0, unknown: 1, slipping: 2, steady: 3, strong: 4 };

export type DimensionKey = "academic" | "manners" | "duties" | "faith" | "wellbeing" | "money";

export interface Dimension {
  key: DimensionKey;
  label: string;
  emoji: string;
  rating: Rating;
  /** One line a parent can act on, naming the number it rests on. */
  headline: string;
  /** The facts underneath, each short enough to read at a glance. */
  evidence: string[];
  /** Where the full detail lives, as an anchor on the child's own page. */
  anchor: string;
}

export interface Evaluation {
  dimensions: Dimension[];
  /** The sentence a parent reads before anything else. */
  verdict: string;
  /** The dimensions that are worse than steady, worst first. */
  needsYou: Dimension[];
  /** How many of the six the app could actually see. */
  measured: number;
}

const pct = (done: number, due: number) => (due === 0 ? null : done / due);

/** A share of something due, turned into a rating. Null (nothing was due) is unknown, not strong. */
export function rate(share: number | null): Rating {
  if (share === null) return "unknown";
  if (share >= 0.85) return "strong";
  if (share >= 0.6) return "steady";
  if (share >= 0.3) return "slipping";
  return "poor";
}

export interface EvaluationInput {
  /** Learning: classes written up, planned quizzes attempted, homework in on time, and how the answers went. */
  academic: {
    classesDue: number; classesLogged: number;
    quizzesPlanned: number; quizzesAttempted: number;
    homeworkDue: number; homeworkOnTime: number;
    recentQuizzes: number; recentCorrect: number; recentTotal: number;
    gradeAverage: number | null; gradePrevious: number | null;
  };
  /** Manners: the parent's own daily judgement, and anything serious raised this fortnight. */
  manners: { daysTicked: number; daysBad: number; daysElapsed: number; alerts: number };
  /** Home duties: the photographed chores, plus the dish and phone columns. */
  duties: { snapsDue: number; snapsDone: number; dishTicked: number; dishBad: number; phoneTicked: number; phoneBad: number; daysElapsed: number };
  /** Faith: days with four or more prayers logged. */
  faith: { daysElapsed: number; daysWithFour: number; logged: number };
  /** Wellbeing: the traffic light the child's own answers produce, never the answers. */
  wellbeing: { band: "green" | "amber" | "red" | null; signals: number };
  /** Money: what he holds, what is owed, and whether the week is paying at all. */
  money: { points: number; owedEgp: number; requests: number; blocked: boolean };
}

function academicOf(a: EvaluationInput["academic"]): Dimension {
  const parts: (number | null)[] = [pct(a.classesLogged, a.classesDue), pct(a.quizzesAttempted, a.quizzesPlanned), pct(a.homeworkOnTime, a.homeworkDue)];
  const known = parts.filter((p): p is number => p !== null);
  const share = known.length ? known.reduce((s, p) => s + p, 0) / known.length : null;
  const evidence: string[] = [];
  if (a.classesDue > 0) evidence.push(`${a.classesLogged} of ${a.classesDue} classes written up`);
  if (a.quizzesPlanned > 0) evidence.push(`${a.quizzesAttempted} of ${a.quizzesPlanned} planned quizzes attempted`);
  if (a.homeworkDue > 0) evidence.push(`${a.homeworkOnTime} of ${a.homeworkDue} homeworks in on time`);
  if (a.recentTotal > 0) evidence.push(`${Math.round((a.recentCorrect / a.recentTotal) * 100)}% right across ${a.recentQuizzes} recent quiz${a.recentQuizzes === 1 ? "" : "zes"}`);
  if (a.gradeAverage !== null) {
    const move = a.gradePrevious === null ? "" : a.gradeAverage > a.gradePrevious ? ` (up from ${a.gradePrevious})` : a.gradeAverage < a.gradePrevious ? ` (down from ${a.gradePrevious})` : " (unchanged)";
    evidence.push(`School average ${a.gradeAverage}${move}`);
  }
  return {
    key: "academic", label: "Academic", emoji: "📚", anchor: "#academic",
    rating: rate(share),
    headline: share === null ? "Nothing was due and nothing was logged this week." : `${Math.round(share * 100)}% of the schoolwork he owed this week.`,
    evidence,
  };
}

function mannersOf(m: EvaluationInput["manners"]): Dimension {
  const evidence: string[] = [];
  if (m.daysTicked > 0) evidence.push(`${m.daysTicked} of ${m.daysElapsed} days judged · ${m.daysBad} marked ✗`);
  if (m.alerts > 0) evidence.push(`${m.alerts} thing${m.alerts === 1 ? "" : "s"} the app thought worth raising`);
  if (m.daysTicked === 0) {
    return {
      key: "manners", label: "Manners", emoji: "🤝", anchor: "#manners", rating: "unknown",
      headline: `You have not judged a single day out of ${m.daysElapsed}. Nobody but you can measure this one.`,
      evidence,
    };
  }
  const good = (m.daysTicked - m.daysBad) / m.daysTicked;
  return {
    key: "manners", label: "Manners", emoji: "🤝", anchor: "#manners",
    rating: m.alerts > 0 && good >= 0.85 ? "steady" : rate(good),
    headline: m.daysBad === 0 ? `Clean on all ${m.daysTicked} day${m.daysTicked === 1 ? "" : "s"} you judged.` : `${m.daysBad} of ${m.daysTicked} judged days marked ✗.`,
    evidence,
  };
}

function dutiesOf(d: EvaluationInput["duties"]): Dimension {
  const snapShare = pct(d.snapsDone, d.snapsDue);
  const dish = d.dishTicked ? (d.dishTicked - d.dishBad) / d.dishTicked : null;
  const phone = d.phoneTicked ? (d.phoneTicked - d.phoneBad) / d.phoneTicked : null;
  const known = [snapShare, dish, phone].filter((p): p is number => p !== null);
  const share = known.length ? known.reduce((s, p) => s + p, 0) / known.length : null;
  const evidence: string[] = [];
  if (d.snapsDue > 0) evidence.push(`${d.snapsDone} of ${d.snapsDue} chores photographed`);
  else evidence.push("No chore was due this week");
  evidence.push(d.dishTicked ? `Dish and space: ${d.dishBad} ✗ in ${d.dishTicked} judged days` : "Dish and space never judged");
  evidence.push(d.phoneTicked ? `Phone parked: ${d.phoneBad} ✗ in ${d.phoneTicked} judged days` : "Phone parked never judged");
  return {
    key: "duties", label: "Home duties", emoji: "🧹", anchor: "#duties",
    rating: rate(share),
    headline: d.snapsDue > 0 && d.snapsDone === 0
      ? `Not one of ${d.snapsDue} chores photographed. The week pays nothing on that alone.`
      : share === null ? "Nothing due and nothing judged." : `${Math.round(share * 100)}% of what he owed at home.`,
    evidence,
  };
}

function faithOf(f: EvaluationInput["faith"]): Dimension {
  // Prayer is always measured: a day with none logged is a fact, not a gap in the app's view.
  const share = f.daysElapsed === 0 ? null : f.daysWithFour / f.daysElapsed;
  return {
    key: "faith", label: "Prayers", emoji: "🕌", anchor: "#faith",
    rating: rate(share),
    headline: f.logged === 0
      ? `Not one prayer logged in ${f.daysElapsed} day${f.daysElapsed === 1 ? "" : "s"}.`
      : `${f.daysWithFour} of ${f.daysElapsed} days with four or more logged.`,
    evidence: [`${f.logged} prayer${f.logged === 1 ? "" : "s"} logged this week`],
  };
}

function wellbeingOf(w: EvaluationInput["wellbeing"]): Dimension {
  const rating: Rating = w.band === null ? "unknown" : w.band === "green" ? (w.signals > 0 ? "steady" : "strong") : w.band === "amber" ? "slipping" : "poor";
  return {
    key: "wellbeing", label: "How he is in himself", emoji: "💓", anchor: "#wellbeing",
    rating,
    headline: w.band === null
      ? "He has not done a coach check-in, so there is nothing to read."
      : w.band === "green" ? "His own answers read as settled." : w.band === "amber" ? "His own answers are worth a quiet conversation." : "His own answers are a reason to sit with him today.",
    evidence: w.signals > 0 ? [`${w.signals} signal${w.signals === 1 ? "" : "s"} worth watching`] : [],
  };
}

function moneyOf(m: EvaluationInput["money"]): Dimension {
  const evidence = [`${m.points} points held`, `${m.owedEgp} EGP owed`];
  if (m.requests > 0) evidence.push(`${m.requests} reward request${m.requests === 1 ? "" : "s"} waiting on you`);
  return {
    key: "money", label: "Money and rewards", emoji: "🧾", anchor: "#money",
    // Money is a statement of fact, not a judgement of the child: it is never "poor", only outstanding or settled.
    rating: m.requests > 0 || m.owedEgp > 0 ? "steady" : "strong",
    headline: m.blocked
      ? "This week pays nothing: no chore was photographed."
      : m.owedEgp > 0 ? `${m.owedEgp} EGP is waiting to be handed over.` : "Nothing outstanding.",
    evidence,
  };
}

export function evaluate(i: EvaluationInput): Evaluation {
  const dimensions = [academicOf(i.academic), mannersOf(i.manners), dutiesOf(i.duties), faithOf(i.faith), wellbeingOf(i.wellbeing), moneyOf(i.money)];
  // Money is excluded from "measured": it always has a number, so counting it would flatter the total.
  const judged = dimensions.filter((d) => d.key !== "money");
  const measured = judged.filter((d) => d.rating !== "unknown").length;
  const needsYou = dimensions
    .filter((d) => d.key !== "money" && RATING_RANK[d.rating] < RATING_RANK.steady)
    .sort((a, b) => RATING_RANK[a.rating] - RATING_RANK[b.rating]);

  let verdict: string;
  if (measured === 0) {
    verdict = "The app cannot see anything about him this week. Nothing here is a judgement of him — it is a judgement of how little was recorded.";
  } else if (needsYou.length === 0) {
    verdict = `Steady or better on all ${measured} of the ${judged.length} the app could see.`;
  } else {
    const names = needsYou.map((d) => d.label.toLowerCase());
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    verdict = `Worth your attention: ${list}. ${measured} of ${judged.length} could be measured at all.`;
  }
  return { dimensions, verdict, needsYou, measured };
}
