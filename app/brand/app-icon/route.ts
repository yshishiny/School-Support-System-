import { brand, iconSvg } from "@/lib/brand";

/** The app icon for this deployment: the live site's purple, the beta's orange. */
export function GET(request: Request) {
  const size = Math.min(1024, Math.max(32, Number(new URL(request.url).searchParams.get("size") ?? 64) || 64));
  return new Response(iconSvg(brand(), size), {
    headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" },
  });
}
