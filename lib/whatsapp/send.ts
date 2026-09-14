/**
 * Sends a WhatsApp text to the parent. Provider is chosen by WHATSAPP_PROVIDER:
 *  - "callmebot": free personal-use gateway (https://www.callmebot.com/blog/free-api-whatsapp-messages/)
 *  - "meta": WhatsApp Cloud API (needs a Meta business app; free-form text only inside the 24h window)
 *  - anything else: not sent, only stored in the dashboard.
 */
export type SendResult = { channel: string; ok: boolean; error?: string };

export async function sendWhatsApp(toPhone: string | null, text: string): Promise<SendResult> {
  const provider = (process.env.WHATSAPP_PROVIDER ?? "").toLowerCase();
  if (!provider) return { channel: "none", ok: false, error: "WHATSAPP_PROVIDER not configured" };
  if (!toPhone) return { channel: provider, ok: false, error: "No parent WhatsApp number set" };
  const to = toPhone.replace(/[^\d]/g, "");

  try {
    if (provider === "callmebot") {
      const key = process.env.CALLMEBOT_API_KEY;
      if (!key) return { channel: provider, ok: false, error: "CALLMEBOT_API_KEY missing" };
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(to)}&apikey=${encodeURIComponent(key)}&text=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (!res.ok) return { channel: provider, ok: false, error: `HTTP ${res.status}` };
      return { channel: provider, ok: true };
    }
    if (provider === "meta") {
      const token = process.env.META_WA_TOKEN;
      const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
      if (!token || !phoneId) return { channel: provider, ok: false, error: "META_WA_TOKEN / META_WA_PHONE_NUMBER_ID missing" };
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
      });
      if (!res.ok) return { channel: provider, ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
      return { channel: provider, ok: true };
    }
    return { channel: provider, ok: false, error: `Unknown provider ${provider}` };
  } catch (err) {
    return { channel: provider, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Link the parent can tap to share the report manually from their own phone. */
export function waShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
