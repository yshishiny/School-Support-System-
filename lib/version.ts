/** The product identity shown under More → About and in the daily report footer. Bump on every release. */
export const APP_NAME = "Study Portal";
export const APP_VERSION = "2.0.0-beta.13";
export const APP_BASELINE = "V2 beta · a wallet for each child · carries everything up to 1.15.0";
export const APP_OWNER = "Yasser Elshishiny";
export const APP_TRADEMARK = "Betna Group";
export const APP_YEAR = 2026;

/** Short build id from the deployment, when Vercel provides one. */
export function buildId(): string {
  return (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "local").slice(0, 7);
}
