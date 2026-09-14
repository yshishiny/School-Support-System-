/**
 * Parses the text produced by WhatsApp's "Export chat" feature.
 * Handles both Android ("14/09/2026, 20:15 - Name: text") and iOS
 * ("[14/09/2026, 8:15:32 PM] Name: text") formats, multi-line messages,
 * and the invisible LRM characters iOS sprinkles in.
 */
export interface WaMessage {
  date: string; // YYYY-MM-DD (best effort)
  time: string; // HH:MM
  sender: string;
  text: string;
}

const LINE_RE =
  /^‎?\[?(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?\]?\s*(?:-\s*)?([^:]{1,80}?):\s(.*)$/;

export function parseWhatsAppExport(raw: string): WaMessage[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const messages: WaMessage[] = [];
  let current: WaMessage | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/[‎‏‪-‮]/g, "");
    const m = LINE_RE.exec(line);
    if (m) {
      const [, a, b, y, hh, mm, ampm, sender, text] = m;
      const { day, month } = dayMonth(Number(a), Number(b));
      let hour = Number(hh);
      if (ampm) {
        const pm = ampm.toLowerCase() === "pm";
        if (pm && hour < 12) hour += 12;
        if (!pm && hour === 12) hour = 0;
      }
      const year = y.length === 2 ? 2000 + Number(y) : Number(y);
      current = {
        date: `${year}-${pad(month)}-${pad(day)}`,
        time: `${pad(hour)}:${mm}`,
        sender: sender.trim(),
        text: text.trim(),
      };
      messages.push(current);
    } else if (current && line.trim() !== "") {
      current.text += "\n" + line.trim();
    }
  }
  return messages.filter((m) => !isSystemNoise(m.text));
}

/** Egypt writes day/month; fall back to month/day only when the first number cannot be a day. */
function dayMonth(a: number, b: number): { day: number; month: number } {
  if (a > 12 && b <= 12) return { day: a, month: b };
  if (b > 12 && a <= 12) return { day: b, month: a };
  return { day: a, month: b };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isSystemNoise(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t === "<media omitted>" ||
    t === "image omitted" ||
    t === "video omitted" ||
    t === "sticker omitted" ||
    t === "this message was deleted" ||
    t === "you deleted this message" ||
    t.startsWith("messages and calls are end-to-end encrypted")
  );
}

/** Keep only messages on or after `sinceDate` (YYYY-MM-DD). */
export function filterSince(messages: WaMessage[], sinceDate: string): WaMessage[] {
  return messages.filter((m) => m.date >= sinceDate);
}

/** Render messages as compact text for the model. */
export function renderForModel(messages: WaMessage[]): string {
  return messages.map((m) => `[${m.date} ${m.time}] ${m.sender}: ${m.text}`).join("\n");
}
