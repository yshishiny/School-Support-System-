import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * What is running here. `id` changes on every deployment, so open tabs can notice a new version and refresh
 * themselves; `commit` is the same stamp the browser bundle was built with, so a page that hits an error can
 * tell a genuine fault from a page that simply outlived its deployment.
 */
export function GET() {
  return NextResponse.json(
    { id: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev", commit: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
