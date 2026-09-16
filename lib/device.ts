/** Small user-agent and request-header reader: enough to say "iPhone · Safari · Cairo, EG" in a report. */
export interface DeviceInfo {
  type: "phone" | "tablet" | "desktop" | "unknown";
  os: string;
  browser: string;
}

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";
  let os = "Unknown";
  if (/iPhone|iPod/.test(s)) os = "iPhone";
  else if (/iPad/.test(s) || (/Macintosh/.test(s) && /Mobile/.test(s))) os = "iPad";
  else if (/Android/.test(s)) {
    const m = /Android [\d.]+; ([^;)]+)/.exec(s);
    os = m ? `Android · ${m[1].replace(/ Build.*/, "").trim()}` : "Android";
  } else if (/Windows/.test(s)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(s)) os = "Mac";
  else if (/CrOS/.test(s)) os = "ChromeOS";
  else if (/Linux/.test(s)) os = "Linux";

  let browser = "Browser";
  if (/Edg\//.test(s)) browser = "Edge";
  else if (/OPR\//.test(s)) browser = "Opera";
  else if (/SamsungBrowser/.test(s)) browser = "Samsung Internet";
  else if (/Chrome\//.test(s) && !/Chromium/.test(s)) browser = "Chrome";
  else if (/Firefox\//.test(s)) browser = "Firefox";
  else if (/Safari\//.test(s) && !/Chrome/.test(s)) browser = "Safari";
  if (/wv\)|; wv/.test(s)) browser = "In-app";

  const type: DeviceInfo["type"] = os === "iPad" || /Tablet/.test(s) ? "tablet" : /iPhone|Android.*Mobile|Mobile/.test(s) ? "phone" : os === "Unknown" ? "unknown" : "desktop";
  return { type, os, browser };
}

export interface RequestContext {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  userAgent: string | null;
  device: DeviceInfo;
}

/** Reads IP, Vercel geo headers and the user agent from any Headers-like object. */
export function requestContext(get: (name: string) => string | null | undefined): RequestContext {
  const dec = (v: string | null | undefined) => (v ? decodeURIComponent(v) : null);
  const ip = (get("x-forwarded-for") ?? "").split(",")[0].trim() || get("x-real-ip") || null;
  const ua = get("user-agent") ?? null;
  const lat = Number(get("x-vercel-ip-latitude"));
  const lng = Number(get("x-vercel-ip-longitude"));
  return {
    ip: ip || null,
    city: dec(get("x-vercel-ip-city")),
    region: dec(get("x-vercel-ip-country-region")),
    country: get("x-vercel-ip-country") ?? null,
    latitude: Number.isFinite(lat) && lat !== 0 ? lat : null,
    longitude: Number.isFinite(lng) && lng !== 0 ? lng : null,
    userAgent: ua,
    device: parseUserAgent(ua),
  };
}

/** "Cairo, EG · iPhone Safari" */
export function describeAccess(a: { city: string | null; country: string | null; device_os: string | null; device_browser: string | null }): string {
  const where = [a.city, a.country].filter(Boolean).join(", ") || "location unknown";
  const what = [a.device_os, a.device_browser].filter(Boolean).join(" ") || "unknown device";
  return `${where} · ${what}`;
}
