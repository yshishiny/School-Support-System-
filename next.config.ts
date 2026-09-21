import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// The one place a version number is written down is package.json. It used to be written down twice — there and
// in lib/version.ts — and the two drifted fifteen releases apart without anything noticing, so every screen in
// the app told a parent it was running a build from a week earlier. Reading it here means the app cannot state
// a version the package does not have.
const APP_VERSION: string = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

// Every build is stamped with the commit it came from. The browser keeps the stamp of the bundle it downloaded,
// so a tab left open across a deployment can tell that it is talking to a newer server and reload itself
// instead of showing a child "something went wrong" for a mismatch that is nobody's fault.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID, NEXT_PUBLIC_APP_VERSION: APP_VERSION },
  // The beta is deployed several times a day and is where faults are chased: minified names like "u is not a
  // function" say nothing, so it ships maps. The stable site does not pay the build time.
  productionBrowserSourceMaps: process.env.VERCEL_GIT_COMMIT_REF === "v2",
};

export default nextConfig;
