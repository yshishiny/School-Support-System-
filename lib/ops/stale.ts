/**
 * Telling a page that outlived its deployment from a page with a bug in it.
 *
 * These are the same event to a browser and opposite events to a person: one wants a refresh and no report, the
 * other wants a report and no refresh. Guessing from the message is what this used to do, and it is not good
 * enough — a redeployed build gave a child `u is not a function`, which reads exactly like a real fault and
 * matches none of the phrases below. Four of those were reported as bugs and hunted through code that was fine.
 *
 * So the build stamps decide whenever they can: the commit the page was built from against the commit answering
 * now. The phrases are only the fallback for when the running build cannot be established.
 */
const STALE_PHRASES = /server action|failed to find|chunk|Loading CSS|dynamically imported module|Unexpected token '<'/i;

export interface Staleness {
  /** The error message the browser reported. */
  message: string;
  /** The commit this page's bundle was built from. */
  pageBuild: string;
  /** The commit serving now, or null when it could not be read. */
  serverBuild: string | null;
}

export function looksStale({ message, pageBuild, serverBuild }: Staleness): boolean {
  // A known build that differs is proof, whatever the message says.
  if (serverBuild && serverBuild !== pageBuild) return true;
  // A known build that matches is proof the other way: the code really is at fault, so do not let a phrase
  // like "chunk" talk us out of reporting it.
  if (serverBuild && serverBuild === pageBuild) return false;
  return STALE_PHRASES.test(message);
}
