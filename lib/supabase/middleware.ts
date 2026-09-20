import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { logAccess } from "@/lib/access/log";
import { touchPresence } from "@/lib/access/presence";

// /api/version answers "which build is serving?" and nothing else. It has to be public: the tab most likely to
// ask is one left open for hours, whose session has quietly lapsed — and a redirect to /login there turns the
// staleness check into a silent no, which is how a redeployed page came to be reported as a code fault.
const PUBLIC_PATHS = ["/login", "/signup", "/join", "/api/cron", "/api/version"];

export async function updateSession(request: NextRequest, event?: NextFetchEvent) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  // First page of the day on this device: record where and on what they came in.
  if (user && !path.startsWith("/api") && !path.startsWith("/_next")) {
    const day = new Date().toISOString().slice(0, 10);
    if (request.cookies.get("al")?.value !== day) {
      const write = logAccess(user.id, "visit", (n) => request.headers.get(n), path);
      if (event) event.waitUntil(write); else await write;
      response.cookies.set("al", day, { path: "/", maxAge: 60 * 60 * 26, sameSite: "lax", httpOnly: true });
    }
    // Presence for the parent's live panel: at most once per two minutes per device.
    const bucket = String(Math.floor(Date.now() / 120000));
    if (request.cookies.get("ps")?.value !== bucket) {
      const touch = touchPresence(user.id, path);
      if (event) event.waitUntil(touch); else await touch;
      response.cookies.set("ps", bucket, { path: "/", maxAge: 120, sameSite: "lax", httpOnly: true });
    }
  }
  return response;
}
