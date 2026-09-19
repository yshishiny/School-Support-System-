/**
 * Selling access to the virtual teacher. Pure arithmetic and the price list; everything that touches the database
 * lives in lib/actions/access.ts.
 *
 * Credits are the unit, so a gift, a referral and a purchase are all the same currency. The anchor the owner set:
 * 1500 credits buys one child two days, and a month for one child costs 450 EGP — which fixes the rate at
 * 50 credits to the pound, and a child-day at 750 credits.
 */
export const CREDITS_PER_EGP = 50;
export const CREDITS_PER_CHILD_DAY = 750;

/** Every family starts with two invitations, and earns two more for each one that turns into a paying family. */
export const MAX_INVITES = 2;
export const INVITES_PER_CONVERSION = 2;
export const INVITES_CEILING = 50;

/** A quarter off the newcomer's first purchase, on one purchase only. */
export const WELCOME_DISCOUNT = 0.25;

/**
 * What the inviter is paid, and when. Not on a signature: on the invited family's *second* purchase, because a
 * family that pays twice is a family that stayed, and paying for a signature is how referral schemes rot.
 */
export const REFERRAL_BONUS_CREDITS = 22_500; // a child-month
export const PAYMENTS_BEFORE_BONUS = 2;

/** Kept for the older grant made on redemption; the real reward is the bonus above. */
export const REFERRAL_CREDITS = 500;

export type Tier = "parent" | "ambassador" | "partner";

export const TIERS: { id: Tier; label: string; from: number; rate: number; blurb: string }[] = [
  { id: "parent", label: "Parent", from: 0, rate: 0, blurb: "Two invitations, and a free month for each family that stays." },
  { id: "ambassador", label: "Ambassador", from: 5, rate: 0.2, blurb: "A fifth of what your families pay, every month they stay." },
  { id: "partner", label: "Partner", from: 20, rate: 0.25, blurb: "A quarter of what your families pay, and your own page and price." },
];

/** A family counts towards a tier once it has paid, not once it has joined. */
export function tierFor(payingFamilies: number): (typeof TIERS)[number] {
  return [...TIERS].reverse().find((t) => payingFamilies >= t.from) ?? TIERS[0];
}

export function commissionFor(payingFamilies: number, creditsSpent: number): number {
  return Math.round(creditsSpent * tierFor(payingFamilies).rate);
}

/** Two to begin with, two more for each family that converted, so a dormant inviter cannot flood anyone. */
export function invitesAllowed(converted: number): number {
  return Math.min(INVITES_CEILING, MAX_INVITES + INVITES_PER_CONVERSION * Math.max(0, converted));
}

/** The newcomer's discount applies once, to their first purchase. */
export function priceAfterWelcome(credits: number, used: boolean): number {
  return used ? credits : Math.round(credits * (1 - WELCOME_DISCOUNT));
}

/** Whether the inviter's bonus falls due on this purchase: exactly on the second one, never again. */
export function bonusDue(purchasesByInvited: number, alreadyRewarded: boolean): boolean {
  return !alreadyRewarded && purchasesByInvited >= PAYMENTS_BEFORE_BONUS;
}

export type PlanId = "child_2days" | "child_week" | "child_month" | "family_month" | "family_term";

export interface Plan {
  id: PlanId;
  label: string;
  /** null = the whole family; otherwise one child. */
  scope: "child" | "family";
  days: number;
  credits: number;
  blurb: string;
}

/**
 * The price list. A family plan covers up to four children and is priced at a little over half what four
 * separate children would cost, because a house that buys for everyone should not pay four times.
 */
export const PLANS: Plan[] = [
  { id: "child_2days", label: "One child, two days", scope: "child", days: 2, credits: 1500, blurb: "A taste of it: two days of lessons for one child." },
  { id: "child_week", label: "One child, a week", scope: "child", days: 7, credits: 5250, blurb: "A full week for one child." },
  { id: "child_month", label: "One child, a month", scope: "child", days: 30, credits: 22500, blurb: "The usual one: a month of lessons for one child." },
  { id: "family_month", label: "The whole family, a month", scope: "family", days: 30, credits: 60000, blurb: "Every child in the house for a month, for the price of under three." },
  { id: "family_term", label: "The whole family, a term", scope: "family", days: 120, credits: 210000, blurb: "Four months for everyone, cheaper again by the month." },
];

export function planById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function egpFor(credits: number): number {
  return Math.round(credits / CREDITS_PER_EGP);
}

export function creditsFor(egp: number): number {
  return Math.round(egp * CREDITS_PER_EGP);
}

/** What the family can see on the price list: credits and what that is in money. */
export function priceList(): { plan: Plan; egp: number; perChildPerMonth: number | null }[] {
  return PLANS.map((plan) => ({
    plan,
    egp: egpFor(plan.credits),
    perChildPerMonth: plan.scope === "child" ? Math.round((egpFor(plan.credits) / plan.days) * 30) : null,
  }));
}

export interface CreditEntry {
  delta: number;
  kind: "grant" | "spend" | "referral" | "refund";
}

export function creditBalance(entries: CreditEntry[]): number {
  return entries.reduce((s, e) => s + e.delta, 0);
}

export interface AccessGrant {
  student_id: string | null;
  starts_on: string;
  ends_on: string;
  plan: string;
}

/** Whether a child may use the teacher on a date: his own grant, or one covering the whole family. */
export function hasAccess(grants: AccessGrant[], studentId: string, day: string): boolean {
  return grants.some((g) => (g.student_id === null || g.student_id === studentId) && g.starts_on <= day && g.ends_on >= day);
}

/** The day access runs out for this child, or null when he has none. */
export function accessUntil(grants: AccessGrant[], studentId: string, day: string): string | null {
  const mine = grants.filter((g) => (g.student_id === null || g.student_id === studentId) && g.ends_on >= day);
  if (mine.length === 0) return null;
  return mine.map((g) => g.ends_on).sort().reverse()[0];
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * When a new grant should run. Buying again while access is still live extends from the last day rather than
 * overlapping it, so nobody loses days by paying early.
 */
export function grantWindow(plan: Plan, today: string, currentEnd: string | null): { starts_on: string; ends_on: string } {
  const start = currentEnd && currentEnd >= today ? addDays(currentEnd, 1) : today;
  return { starts_on: start, ends_on: addDays(start, plan.days - 1) };
}

/** A short, unambiguous invite code: no letters a child could misread aloud. */
export function inviteCode(random: () => number = Math.random): string {
  const alphabet = "ACDEFHJKMNPRTVWXY3479";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
}
