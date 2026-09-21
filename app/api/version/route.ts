import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";
import { brand } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * What is running here. `id` changes on every deployment, so open tabs can notice a new version and refresh
 * themselves; `commit` is the same stamp the browser bundle was built with, so a page that hits an error can
 * tell a genuine fault from a page that simply outlived its deployment. `version` and `site` are here so that
 * "which build is each of the two sites running?" can be answered from a browser without logging into either.
 */
export function GET() {
  return NextResponse.json(
    {
      id: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
      commit: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
      version: APP_VERSION,
      site: brand().label,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
