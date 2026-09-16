import { requestContext } from "@/lib/device";

/**
 * Writes one access_logs row through the REST API with the service role. Plain fetch so it runs in the
 * Edge middleware and in Node actions alike. Never throws: logging must not break a login.
 */
export async function logAccess(userId: string, event: "login" | "visit", get: (name: string) => string | null | undefined, path: string | null): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const c = requestContext(get);
  try {
    await fetch(`${url}/rest/v1/access_logs`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: userId,
        event,
        ip: c.ip,
        city: c.city,
        region: c.region,
        country: c.country,
        latitude: c.latitude,
        longitude: c.longitude,
        device_type: c.device.type,
        device_os: c.device.os,
        device_browser: c.device.browser,
        user_agent: c.userAgent?.slice(0, 400) ?? null,
        path,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[access] log failed", err);
  }
}
