/** The product identity shown under More → About and in the daily report footer. */
export const APP_NAME = "Study Portal";

/**
 * The running version, taken from package.json at build time — never written here.
 *
 * It used to be a literal in this file as well as in package.json, and the two drifted: the package said
 * 2.1.0-beta.18 while every screen in the app said 2.1.0-beta.3, and on the live site a stale "2.1.0" was even
 * being read as "this is the beta". A version a user reads has to be the version that is running, so there is
 * one place it is written and this is not it. next.config.ts injects it; lib/version.test.ts holds the line.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0-dev";
export const APP_BASELINE = "V2 beta \u00b7 every failure says where it happened \u00b7 carries everything up to 1.15.1";
export const APP_OWNER = "Yasser Elshishiny";
export const APP_TRADEMARK = "Betna Group";
export const APP_YEAR = 2026;

/** Short build id from the deployment, when Vercel provides one. */
export function buildId(): string {
  return (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "local").slice(0, 7);
}
