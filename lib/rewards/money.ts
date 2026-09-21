/**
 * What a reward actually pays, as opposed to what its title says it pays.
 *
 * A reward called "500 EGP" was set up with a cash amount of 100. A child with 214 points saw a card
 * priced at 200 and pressed the button; the approval row a parent then reads shows the title and the
 * points and never the amount, so both sides believed a different number and neither was lying. The
 * title is free text and always will be — the fix is that the amount is shown beside it everywhere,
 * and a title whose number contradicts the amount is called out where it is set up and where it is
 * approved.
 */

/** "500 EGP", "1,500 LE", "٢٠٠ جنيه" — numbers in a title that are making a claim about money. */
const MONEY = /(\d[\d,\s]*(?:\.\d+)?)\s*(?:egp|le\b|l\.e\.?|pounds?|جنيه|جنيهات)/gi;

export function moneyInTitle(title: string): number[] {
  const out: number[] = [];
  for (const m of title.matchAll(MONEY)) {
    const n = Number(m[1].replace(/[,\s]/g, ""));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

/**
 * The number the title promises and the number the reward pays, when they differ.
 *
 * A title that names no money is never a mismatch: most rewards are not cash. A title that names a
 * figure the reward does pay is not a mismatch either, which is the common and correct case
 * ("Savings match (100 EGP)" paying 100).
 */
export function titleMoneyMismatch(title: string, cashAmountEgp: number | string | null | undefined): { claimed: number; actual: number } | null {
  const claims = moneyInTitle(title);
  if (claims.length === 0) return null;
  const actual = Number(cashAmountEgp ?? 0) || 0;
  if (claims.some((c) => c === actual)) return null;
  return { claimed: claims[0], actual };
}

/** One line a parent can act on, or null when the title and the amount agree. */
export function mismatchLine(title: string, cashAmountEgp: number | string | null | undefined): string | null {
  const m = titleMoneyMismatch(title, cashAmountEgp);
  if (!m) return null;
  return m.actual === 0
    ? `The title says ${m.claimed} EGP but this reward pays no money at all.`
    : `The title says ${m.claimed} EGP but this reward pays ${m.actual} EGP.`;
}

/** What approving a redemption will actually put in the child's wallet. */
export function payoutOf(reward: { cash_amount_egp?: number | string | null }): number {
  return Number(reward.cash_amount_egp ?? 0) || 0;
}
