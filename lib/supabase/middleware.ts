import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { logAccess } from "@/lib/access/log";

const PUBLIC_PATHS = ["/login", "/signup", "/join", "/api/cron"];

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
  }
  return response;
}
