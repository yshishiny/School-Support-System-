/**
 * The child's wallet, kept the way a real one works so the arithmetic teaches itself.
 *
 * Money earned (a paid allowance week, a cash reward) is held *with Dad* until he hands it over. A hand-over is a
 * withdrawal: it leaves the held balance and becomes cash *in the pocket*. What the child then spends comes off the
 * pocket. Two balances, one ledger, and they must always add up — which is the whole lesson.
 */
export type WalletKind = "earn" | "withdraw" | "spend" | "adjust";

export interface WalletEntry {
  id: string;
  kind: WalletKind;
  amount_egp: number;
  label: string;
  category: string | null;
  occurred_on: string; // YYYY-MM-DD
  note?: string | null;
  /** A claim to be paid back for money spent on the family or on school. */
  claim_status?: ClaimStatus | null;
  claim_purpose?: ClaimPurpose | null;
  claim_reason?: string | null;
  asked_permission?: boolean | null;
  claim_note?: string | null;
}

export type ClaimStatus = "none" | "requested" | "approved" | "rejected";
export type ClaimPurpose = "family" | "school";

export const CLAIM_PURPOSES: { id: ClaimPurpose; label: string; emoji: string; hint: string }[] = [
  { id: "family", label: "For the family", emoji: "🏠", hint: "Bread, a taxi for your mother, something the house needed." },
  { id: "school", label: "For school", emoji: "🏫", hint: "A printout, a project material, a trip the school asked for." },
];

/**
 * Whether a line of spending may be claimed back at all. Personal spending never can: the rule is that the money
 * has to have been spent on the family or on school, and it has to be his own recent spending.
 */
export function claimable(e: Pick<WalletEntry, "kind" | "claim_status">): boolean {
  return e.kind === "spend" && (!e.claim_status || e.claim_status === "none" || e.claim_status === "rejected");
}

export const SPEND_CATEGORIES = [
  { id: "food", label: "Food and drinks", emoji: "🍔" },
  { id: "fun", label: "Games and fun", emoji: "🎮" },
  { id: "tech", label: "Tech and gadgets", emoji: "🎧" },
  { id: "school", label: "School things", emoji: "📚" },
  { id: "gift", label: "Gifts and giving", emoji: "🎁" },
  { id: "save", label: "Put aside to save", emoji: "🏦" },
  { id: "other", label: "Something else", emoji: "🧾" },
] as const;

export function categoryLabel(id: string | null): { label: string; emoji: string } {
  const c = SPEND_CATEGORIES.find((x) => x.id === id);
  return c ? { label: c.label, emoji: c.emoji } : { label: "Something else", emoji: "🧾" };
}

export interface Balances {
  earned: number;
  withdrawn: number;
  spent: number;
  adjusted: number;
  /** Money he has earned but not taken yet: what Dad still holds. */
  withDad: number;
  /** Cash he has taken and not yet spent. */
  inPocket: number;
  /** Everything he owns, held plus pocket. */
  net: number;
}

// Rounding can land on -0, which a balance would print as "-0 EGP"; zero is zero.
const round2 = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
};

export function balances(entries: WalletEntry[]): Balances {
  const sum = (k: WalletKind) => entries.filter((e) => e.kind === k).reduce((s, e) => s + Number(e.amount_egp), 0);
  const earned = sum("earn");
  const withdrawn = sum("withdraw");
  const spent = sum("spend");
  const adjusted = sum("adjust");
  return {
    earned: round2(earned),
    withdrawn: round2(withdrawn),
    spent: round2(spent),
    adjusted: round2(adjusted),
    withDad: round2(earned + adjusted - withdrawn),
    inPocket: round2(withdrawn - spent),
    net: round2(earned + adjusted - spent),
  };
}

/** Entries in a calendar month, newest first, for the month view. */
export function entriesInMonth(entries: WalletEntry[], month: string): WalletEntry[] {
  return entries.filter((e) => e.occurred_on.startsWith(month)).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
}

export interface MonthSummary {
  month: string;
  inEgp: number;
  outEgp: number;
  byCategory: { id: string; label: string; emoji: string; amount: number; share: number }[];
  biggest: { label: string; amount: number } | null;
}

/** What came in, what went out and where it went: the month on one page. */
export function monthSummary(entries: WalletEntry[], month: string): MonthSummary {
  const mine = entriesInMonth(entries, month);
  const inEgp = round2(mine.filter((e) => e.kind === "earn" || e.kind === "adjust").reduce((s, e) => s + Number(e.amount_egp), 0));
  const spends = mine.filter((e) => e.kind === "spend");
  const outEgp = round2(spends.reduce((s, e) => s + Number(e.amount_egp), 0));
  const totals = new Map<string, number>();
  for (const s of spends) totals.set(s.category ?? "other", (totals.get(s.category ?? "other") ?? 0) + Number(s.amount_egp));
  const byCategory = [...totals.entries()]
    .map(([id, amount]) => ({ id, ...categoryLabel(id), amount: round2(amount), share: outEgp ? Math.round((amount / outEgp) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);
  const biggest = spends.length ? spends.reduce((a, b) => (Number(a.amount_egp) >= Number(b.amount_egp) ? a : b)) : null;
  return { month, inEgp, outEgp, byCategory, biggest: biggest ? { label: biggest.label, amount: round2(Number(biggest.amount_egp)) } : null };
}

/**
 * A first budget, the one most families teach: half to spend, a third saved for something bigger, the rest given
 * away or kept for gifts. Rounded to whole pounds so a child can actually hold the notes.
 */
export function budgetSplit(amount: number): { spend: number; save: number; give: number } {
  const a = Math.max(0, Math.floor(amount));
  const save = Math.round(a * 0.3);
  const give = Math.round(a * 0.1);
  return { spend: a - save - give, save, give };
}

/** What a child is waiting to be paid back, and what has been agreed. */
export function claimTotals(entries: WalletEntry[]): { requested: number; approved: number; count: number } {
  const req = entries.filter((e) => e.claim_status === "requested");
  const ok = entries.filter((e) => e.claim_status === "approved");
  return {
    requested: round2(req.reduce((s, e) => s + Number(e.amount_egp), 0)),
    approved: round2(ok.reduce((s, e) => s + Number(e.amount_egp), 0)),
    count: req.length,
  };
}

/** How many weeks of the current saving rate a goal still needs. null when nothing is being saved. */
export function weeksToGoal(goal: number, saved: number, perWeek: number): number | null {
  if (perWeek <= 0) return null;
  const left = Math.max(0, goal - saved);
  return Math.ceil(left / perWeek);
}

/**
 * One line of the statement, with the two running balances after it.
 *
 * Every line does exactly one of three things, and saying which is the whole point of the page:
 *  - money *arrives* (a paid allowance week, something a parent added) — the total goes up, and it sits with Dad;
 *  - money is *handed over* — the total does not change at all, it only moves from Dad's side to the pocket;
 *  - money is *spent* — it leaves the pocket, and the total goes down.
 *
 * A hand-over looking like a loss is what made the old page confusing. Here it is shown as a move, with both
 * sides printed after it, so the child can see the total stay still.
 */
export type LineKind = "in" | "moved" | "out";

export interface StatementLine {
  entry: WalletEntry;
  kind: LineKind;
  /** Signed against the total: +in, 0 for a hand-over, −out. */
  delta: number;
  amount: number;
  withDad: number;
  inPocket: number;
  total: number;
}

/** The ledger, oldest first, with the balances after every line. */
export function statement(entries: WalletEntry[]): StatementLine[] {
  const ordered = [...entries].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  let withDad = 0;
  let inPocket = 0;
  const out: StatementLine[] = [];
  for (const entry of ordered) {
    const amount = Number(entry.amount_egp);
    let kind: LineKind;
    let delta: number;
    if (entry.kind === "withdraw") {
      withDad -= amount;
      inPocket += amount;
      kind = "moved";
      delta = 0;
    } else if (entry.kind === "spend") {
      inPocket -= amount;
      kind = "out";
      delta = -amount;
    } else {
      // earn and adjust both arrive on Dad's side; an adjustment may be negative when he takes something back.
      withDad += amount;
      kind = amount < 0 ? "out" : "in";
      delta = amount;
    }
    out.push({ entry, kind, delta, amount, withDad: round2(withDad), inPocket: round2(inPocket), total: round2(withDad + inPocket) });
  }
  return out;
}

/** The statement newest first, which is how anybody actually reads one. */
export function statementDesc(entries: WalletEntry[]): StatementLine[] {
  return statement(entries).reverse();
}
