/**
 * Who may do what to whose account.
 *
 * Every one of these rules is the difference between an administration page and a way for a fourteen-year-old to
 * lock his father out, so they live here as plain functions with tests rather than as `if` statements scattered
 * through server actions. The actions call `may()` and nothing else decides.
 *
 * Three standing rules the individual cases all obey:
 *   1. Nobody can act on an account outside their own family unless they are a system administrator.
 *   2. Nobody can disable or demote themselves — a person who locks themselves out needs another person to undo
 *      it, and in a family of two adults that may be nobody.
 *   3. The last administrator and the last family owner cannot be removed, or the family has no way back in.
 */

export type Role = "parent" | "student";

export interface Actor {
  id: string;
  familyId: string;
  role: Role;
  isAdmin: boolean;
  isFamilyOwner: boolean;
}

export interface Subject {
  id: string;
  familyId: string;
  role: Role;
  isAdmin: boolean;
  isFamilyOwner: boolean;
  disabled: boolean;
}

export type Action =
  | "reset_password"
  | "set_email"
  | "disable"
  | "enable"
  | "grant_admin"
  | "revoke_admin"
  | "transfer_ownership";

export interface World {
  /** How many administrators exist in total, so the last one cannot be removed. */
  admins: number;
  /** How many parents the subject's family has, so its last owner cannot be stripped. */
  parentsInFamily: number;
}

export type Verdict = { ok: true } | { ok: false; why: string };

const no = (why: string): Verdict => ({ ok: false, why });
const yes: Verdict = { ok: true };

export function may(actor: Actor, subject: Subject, action: Action, world: World): Verdict {
  // A child administers nobody, including himself through this door: his own password is changed on his own
  // page, with his current one, which is a different path entirely.
  if (actor.role !== "parent") return no("Only a parent can administer accounts.");

  const sameFamily = actor.familyId === subject.familyId;
  if (!sameFamily && !actor.isAdmin) return no("That account belongs to another family.");

  // Within a family the owner administers everyone; any other parent administers only the children.
  const familyRight = actor.isFamilyOwner || subject.role === "student";
  if (sameFamily && !familyRight && !actor.isAdmin) {
    return no("Only the main parent can administer another parent's account.");
  }

  const self = actor.id === subject.id;

  switch (action) {
    case "reset_password":
      // Setting your own password without knowing the current one would turn a borrowed unlocked laptop into a
      // permanent takeover. Your own password is changed on your own page.
      if (self) return no("Change your own password on your account page, with your current one.");
      return yes;

    case "set_email":
      if (self) return no("Change your own email on your account page.");
      return yes;

    case "disable":
      if (self) return no("You cannot disable your own account.");
      if (subject.isAdmin && world.admins <= 1) return no("That is the last administrator.");
      if (subject.isFamilyOwner && subject.role === "parent") return no("Move ownership to another parent first.");
      return yes;

    case "enable":
      if (!subject.disabled) return no("That account is already active.");
      return yes;

    case "grant_admin":
      // Administration crosses every family, so only an administrator hands it out. A family owner running their
      // own household is not thereby entitled to everyone else's.
      if (!actor.isAdmin) return no("Only an administrator can grant administrator rights.");
      if (subject.role !== "parent") return no("Only a parent can be an administrator.");
      if (subject.isAdmin) return no("Already an administrator.");
      return yes;

    case "revoke_admin":
      if (!actor.isAdmin) return no("Only an administrator can remove administrator rights.");
      if (!subject.isAdmin) return no("Not an administrator.");
      if (self) return no("You cannot remove your own administrator rights.");
      if (world.admins <= 1) return no("That is the last administrator.");
      return yes;

    case "transfer_ownership":
      if (!actor.isFamilyOwner && !actor.isAdmin) return no("Only the main parent can hand over.");
      if (subject.role !== "parent") return no("Only a parent can be the main parent.");
      if (subject.isFamilyOwner) return no("Already the main parent.");
      if (world.parentsInFamily < 2) return no("There is no other parent to hand over to.");
      return yes;
  }
}

/** A password a person can actually be asked to remember, refusing the ones that only look like rules. */
export function passwordProblem(password: string, confirm?: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 200) return "That is too long.";
  if (/^\s|\s$/.test(password)) return "It cannot start or end with a space.";
  if (confirm !== undefined && password !== confirm) return "The two passwords do not match.";
  return null;
}

/** Whether an address is worth sending a verification link to, and whether it is one of the stand-in ones. */
export function emailProblem(email: string, childDomain: string): string | null {
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "That does not look like an email address.";
  if (trimmed.toLowerCase().endsWith(`@${childDomain.toLowerCase()}`)) {
    return `${childDomain} addresses are the stand-in ones the app makes up; use a real inbox.`;
  }
  return null;
}

export function isPlaceholderEmail(email: string | null | undefined, childDomain: string): boolean {
  return !!email && email.toLowerCase().endsWith(`@${childDomain.toLowerCase()}`);
}
