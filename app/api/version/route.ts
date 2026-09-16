import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The running deployment's id, so open tabs can notice a new version and refresh themselves. */
export function GET() {
  const id = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
  return NextResponse.json({ id }, { headers: { "Cache-Control": "no-store" } });
}
