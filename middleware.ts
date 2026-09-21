import { type NextFetchEvent, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  return await updateSession(request, event);
}

/**
 * Everything but the files the browser fetches for itself.
 *
 * `sw.js` was missing from this list, so the service worker script was being served through the auth check. A
 * registration that answers with a redirect to /login is a registration that throws — and `pushState()` turns any
 * throw into "this browser cannot do notifications", which hides the offer without a word. A child would simply
 * never be asked, and nobody would ever learn why. A service worker, the manifest and the icons are fetched by
 * the browser rather than by a person, so they were never the auth layer's business.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icon.png|apple-touch-icon.png|manifest.webmanifest|sw.js|robots.txt).*)"],
};
