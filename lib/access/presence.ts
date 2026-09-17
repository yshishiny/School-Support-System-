/** Presence heartbeat from the middleware: last page and time, at most once per two minutes per device. Never throws. */
export async function touchPresence(userId: string, path: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ last_seen_at: new Date().toISOString(), last_path: path.slice(0, 120) }),
    });
  } catch {
    /* presence is best effort */
  }
}
