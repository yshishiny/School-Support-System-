import type { NextConfig } from "next";

// Every build is stamped with the commit it came from. The browser keeps the stamp of the bundle it downloaded,
// so a tab left open across a deployment can tell that it is talking to a newer server and reload itself
// instead of showing a child "something went wrong" for a mismatch that is nobody's fault.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  // The beta is deployed several times a day and is where faults are chased: minified names like "u is not a
  // function" say nothing, so it ships maps. The stable site does not pay the build time.
  productionBrowserSourceMaps: process.env.VERCEL_GIT_COMMIT_REF === "v2",
};

export default nextConfig;
