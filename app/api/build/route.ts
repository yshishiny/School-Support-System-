import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Which build is serving right now. A page compares it with its own stamp to spot a deployment under its feet. */
export function GET() {
  return NextResponse.json({ id: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" }, { headers: { "cache-control": "no-store" } });
}
