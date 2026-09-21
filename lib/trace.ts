/**
 * One answer to two questions a parent actually asks: how much do I hand him, and what did he do for it.
 *
 * Both answers existed already, scattered: points on Rewards, held money on Allowance → Wallets, closed weeks on
 * Allowance → This week, evidence across Progress, Snaps and the nightly report. Nobody can hold six pages in their
 * head at once, and a parent who cannot trace a figure back to a day stops trusting the figure — which is worse
 * than not having it. This collects them per child, oldest fact to newest, with the money on one side and the
 * evidence for it on the other.
 */
import type { WalletEntry } from "@/lib/wallet";

export interface PointEntry { delta: number; reason: string; created_at: string; ref_type: string | null }
export interface ClosedWeek { id: string; week_start: string; week_end: string; score: number; band: string; amount: number; paid_at: string | null; claimed_at: string | null }

export interface TraceLine {
  on: string;              // YYYY-MM-DD
  at: string | null;       // HH:MM when known
  what: string;
  points: number | null;   // ⭐ moved
  egp: number | null;      // money moved, signed: + into the wallet, − out of it
  kind: "points" | "money";
}

const day = (iso: string) => iso.slice(0, 10);
const time = (iso: string) => (iso.length > 10 ? iso.slice(11, 16) : null);

/** Points and money in one list, newest first. Every figure on the page can be found here with its date. */
export function timeline(points: PointEntry[], wallet: WalletEntry[]): TraceLine[] {
  const fromPoints: TraceLine[] = points.map((p) => ({
    on: day(p.created_at), at: time(p.created_at), what: p.reason, points: p.delta, egp: null, kind: "points",
  }));
  const fromWallet: TraceLine[] = wallet.map((w) => ({
    on: w.occurred_on,
    at: null,
    what: w.label,
    points: null,
    // Signed the way the held balance moves: earning raises what you are holding, a hand-over lowers it.
    egp: w.kind === "earn" || w.kind === "adjust" ? Number(w.amount_egp) : -Number(w.amount_egp),
    kind: "money",
  }));
  return [...fromPoints, ...fromWallet].sort((a, b) => (b.on + (b.at ?? "")).localeCompare(a.on + (a.at ?? "")));
}

export interface Owed {
  /** Money already earned and recorded, sitting with the parent: this is what to hand over. */
  handOver: number;
  /** Closed weeks scored and never marked paid. Marking one paid adds its amount and hands it over at once. */
  unpaidWeeks: ClosedWeek[];
  unpaidTotal: number;
  /** Everything he would hold if every outstanding week were settled today. */
  ifSettled: number;
}

export function owed(withDad: number, weeks: ClosedWeek[]): Owed {
  const unpaidWeeks = weeks.filter((w) => !w.paid_at && w.amount > 0);
  const unpaidTotal = unpaidWeeks.reduce((s, w) => s + w.amount, 0);
  return { handOver: withDad, unpaidWeeks, unpaidTotal, ifSettled: withDad + unpaidTotal };
}

/** One sentence a parent can act on without reading anything else on the page. */
export function verdict(o: Owed, firstName: string): string {
  if (o.ifSettled <= 0) return `Nothing is owed to ${firstName} right now.`;
  const parts: string[] = [];
  if (o.handOver > 0) parts.push(`${o.handOver} EGP already earned and waiting to be handed over`);
  if (o.unpaidTotal > 0) parts.push(`${o.unpaidTotal} EGP from ${o.unpaidWeeks.length} closed week${o.unpaidWeeks.length === 1 ? "" : "s"} you have not marked paid`);
  return `${firstName}: ${parts.join(", and ")}.`;
}

export interface DayEvidence {
  date: string;
  checkedIn: boolean;
  prayers: number;
  classesLogged: number;
  quizzesDone: number;
  snaps: number;
  pointsEarned: number;
}

/** Whether a week has anything in it at all — the difference between a quiet week and an absent child. */
export function weekIsEmpty(days: DayEvidence[]): boolean {
  return days.every((d) => !d.checkedIn && d.prayers === 0 && d.classesLogged === 0 && d.quizzesDone === 0 && d.snaps === 0);
}

/**
 * The counts behind this week's score, read back out of the KPI lines.
 *
 * The evaluation needs "13 of 17 classes" as two numbers, and the honest place to get them is the very lines the
 * score was built from — recomputing them from raw rows invites a page that states two different figures for the
 * same fact. The coupling to those wordings is real, so it is pinned by a test against live scoreWeek output
 * rather than left to be discovered when a label changes.
 */
export interface WeekCounts {
  classesDue: number; classesLogged: number;
  quizzesPlanned: number; quizzesAttempted: number;
  homeworkDue: number; homeworkOnTime: number;
  snapsDue: number; snapsDone: number;
}

export function weekCounts(results: { code: string; detail: string }[]): WeekCounts {
  const pair = (code: string, re: RegExp): [number, number] => {
    const m = (results.find((r) => r.code === code)?.detail ?? "").match(re);
    return m ? [Number(m[1]), Number(m[2])] : [0, 0];
  };
  let snapsDue = 0;
  let snapsDone = 0;
  for (const r of results.filter((x) => x.code.startsWith("snap:"))) {
    const m = r.detail.match(/^(\d+) of (\d+) days? snapped/);
    if (m) { snapsDone += Number(m[1]); snapsDue += Number(m[2]); }
  }
  const [classesLogged, classesDue] = pair("classlog", /^(\d+) of (\d+) classes logged/);
  const [quizzesAttempted, quizzesPlanned] = pair("quizzes", /^(\d+) of (\d+) attempted/);
  const [homeworkOnTime, homeworkDue] = pair("homework", /^(\d+) of (\d+) done on time/);
  return { classesDue, classesLogged, quizzesPlanned, quizzesAttempted, homeworkDue, homeworkOnTime, snapsDue, snapsDone };
}
