/**
 * Reads a WhatsApp "Export chat" archive (zip with media, or a bare .txt), links messages to their
 * attachments and computes simple statistics. Pure functions apart from unzipping.
 */
import { unzipSync } from "fflate";
import { parseWhatsAppExport, type WaMessage } from "./parse-export";

export type AttachmentKind = "image" | "video" | "audio" | "pdf" | "doc" | "sheet" | "slides" | "other";

export interface ArchiveMessage extends WaMessage {
  attachmentName: string | null;
  attachmentKind: AttachmentKind | null;
}

export interface ArchiveFile {
  name: string;
  data: Uint8Array;
  kind: AttachmentKind;
}

export interface ParsedArchive {
  messages: ArchiveMessage[];
  files: ArchiveFile[]; // media files present in the zip
  chatFileName: string | null;
}

/** iOS: "<attached: 00000012-PHOTO-2025-09-10-10-12-00.jpg>"; Android: "IMG-20250910-WA0001.jpg (file attached)". */
const ATTACH_RE = /<attached:\s*([^>]+)>|(\S+\.[A-Za-z0-9]{2,5})\s*\(file attached\)/i;

export function attachmentKind(name: string): AttachmentKind {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) return "image";
  if (["mp4", "mov", "3gp", "avi", "mkv"].includes(ext)) return "video";
  if (["opus", "ogg", "mp3", "m4a", "aac", "wav"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx", "rtf", "txt"].includes(ext)) return "doc";
  if (["xls", "xlsx", "csv"].includes(ext)) return "sheet";
  if (["ppt", "pptx"].includes(ext)) return "slides";
  return "other";
}

/** Splits an attachment reference out of a message and cleans the remaining text. */
export function withAttachment(m: WaMessage): ArchiveMessage {
  const hit = ATTACH_RE.exec(m.text);
  if (!hit) return { ...m, attachmentName: null, attachmentKind: null };
  const name = (hit[1] ?? hit[2]).trim();
  const text = m.text.replace(hit[0], "").replace(/^[\s‎]+|[\s‎]+$/g, "").trim();
  return { ...m, text, attachmentName: name, attachmentKind: attachmentKind(name) };
}

export function parseArchiveText(raw: string): ArchiveMessage[] {
  return parseWhatsAppExport(raw).map(withAttachment);
}

/** Unzips an export; the chat text is the .txt with the most parsed messages (media zips carry only one). */
export function parseArchiveZip(bytes: Uint8Array): ParsedArchive {
  const entries = unzipSync(bytes);
  let best: { name: string; messages: ArchiveMessage[] } | null = null;
  const files: ArchiveFile[] = [];
  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith("/") || name.startsWith("__MACOSX/") || data.length === 0) continue;
    const base = name.split("/").pop()!;
    if (base.toLowerCase().endsWith(".txt") && !/^\d/.test(base)) {
      const messages = parseArchiveText(new TextDecoder("utf-8").decode(data));
      if (!best || messages.length > best.messages.length) best = { name: base, messages };
      continue;
    }
    files.push({ name: base, data, kind: attachmentKind(base) });
  }
  return { messages: best?.messages ?? [], files, chatFileName: best?.name ?? null };
}

export interface ArchiveStats {
  senders: { name: string; messages: number; attachments: number }[];
  kinds: Record<string, number>;
  weekdays: number[]; // messages per weekday, 0 = Sunday
  hours: number[]; // messages per hour of day
  firstDate: string | null;
  lastDate: string | null;
}

export function archiveStats(messages: ArchiveMessage[]): ArchiveStats {
  const bySender = new Map<string, { messages: number; attachments: number }>();
  const kinds: Record<string, number> = {};
  const weekdays = Array(7).fill(0) as number[];
  const hours = Array(24).fill(0) as number[];
  for (const m of messages) {
    const s = bySender.get(m.sender) ?? { messages: 0, attachments: 0 };
    s.messages += 1;
    if (m.attachmentKind) {
      s.attachments += 1;
      kinds[m.attachmentKind] = (kinds[m.attachmentKind] ?? 0) + 1;
    }
    bySender.set(m.sender, s);
    const d = new Date(m.date + "T00:00:00Z");
    if (!Number.isNaN(d.getTime())) weekdays[d.getUTCDay()] += 1;
    hours[Number(m.time.slice(0, 2)) || 0] += 1;
  }
  const dates = messages.map((m) => m.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return {
    senders: [...bySender.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.messages - a.messages).slice(0, 25),
    kinds,
    weekdays,
    hours,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

/** A compact sample for the model: spread across the whole period, attachments marked, capped in length. */
export function sampleForModel(messages: ArchiveMessage[], maxMessages = 350, maxChars = 60000): string {
  const step = Math.max(1, Math.floor(messages.length / maxMessages));
  const picked = messages.filter((_, i) => i % step === 0).slice(0, maxMessages);
  const lines = picked.map((m) => `[${m.date} ${m.time}] ${m.sender}: ${m.text}${m.attachmentKind ? ` <${m.attachmentKind}: ${m.attachmentName}>` : ""}`);
  let out = lines.join("\n");
  if (out.length > maxChars) out = out.slice(0, maxChars);
  return out;
}
