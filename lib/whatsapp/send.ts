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
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const reply = (await res.text()).slice(0, 200);
      if (!res.ok) return { channel: provider, ok: false, error: `CallMeBot HTTP ${res.status}: ${reply}` };
      if (/error|invalid|not registered/i.test(reply)) return { channel: provider, ok: false, error: `CallMeBot: ${reply}` };
      return { channel: provider, ok: true };
    }
    if (provider === "meta") {
      const token = process.env.META_WA_TOKEN;
      const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
      if (!token || !phoneId) return { channel: provider, ok: false, error: "META_WA_TOKEN / META_WA_PHONE_NUMBER_ID missing" };
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        signal: AbortSignal.timeout(20000),
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

/** Telegram bot delivery: official API, no 24-hour window, no third-party gateway. */
export async function sendTelegram(chatId: string | null, text: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { channel: "telegram", ok: false, error: "TELEGRAM_BOT_TOKEN not configured" };
  if (!chatId) return { channel: "telegram", ok: false, error: "Telegram not connected in Settings" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { channel: "telegram", ok: false, error: `Telegram HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { channel: "telegram", ok: true };
  } catch (err) {
    return { channel: "telegram", ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Finds the chat that most recently messaged the bot, so the parent can connect by sending /start. */
export async function findTelegramChat(): Promise<{ chatId: string; name: string } | { error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { error: "TELEGRAM_BOT_TOKEN is not configured on the server." };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`, { signal: AbortSignal.timeout(15000) });
    const json = (await res.json()) as { ok: boolean; result?: { message?: { chat: { id: number; type: string; first_name?: string; username?: string } } }[] };
    if (!json.ok) return { error: "Telegram rejected the bot token." };
    const chats = (json.result ?? []).map((u) => u.message?.chat).filter((c): c is NonNullable<typeof c> => !!c && c.type === "private");
    const last = chats[chats.length - 1];
    if (!last) return { error: "No message found. Open the bot in Telegram, tap Start, then try again." };
    return { chatId: String(last.id), name: last.first_name ?? last.username ?? "Telegram user" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Sends the report on every configured channel. Success if any channel delivered. */
export async function deliverReport(family: { parent_whatsapp: string | null; telegram_chat_id: string | null }, text: string): Promise<SendResult> {
  const results: SendResult[] = [];
  if (family.telegram_chat_id && process.env.TELEGRAM_BOT_TOKEN) results.push(await sendTelegram(family.telegram_chat_id, text));
  if (process.env.WHATSAPP_PROVIDER) results.push(await sendWhatsApp(family.parent_whatsapp, text));
  if (results.length === 0) return { channel: "none", ok: false, error: "No delivery channel configured (Telegram or WhatsApp)" };
  const ok = results.filter((r) => r.ok);
  if (ok.length) return { channel: ok.map((r) => r.channel).join("+"), ok: true };
  return { channel: results.map((r) => r.channel).join("+"), ok: false, error: results.map((r) => `${r.channel}: ${r.error}`).join(" | ") };
}
