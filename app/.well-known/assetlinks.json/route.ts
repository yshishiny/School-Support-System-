import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Digital Asset Links for the Android app (a Trusted Web Activity wrapping this site). Set ANDROID_PACKAGE and
 * ANDROID_SHA256 (the signing certificate fingerprint PWABuilder or Play gives you) in Vercel; until then, an empty list.
 */
export function GET() {
  const pkg = process.env.ANDROID_PACKAGE;
  const sha = (process.env.ANDROID_SHA256 ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const body = pkg && sha.length ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: sha } }] : [];
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
