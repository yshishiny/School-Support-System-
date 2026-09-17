/** Which files School files accepts, how they are shown, and the MIME to send when the browser gives none. Pure. */
export const FILE_KINDS: { mime: string; ext: string[]; label: string; emoji: string; read: "pdf" | "image" | "docx" | "pptx" | "sheet" | "text" }[] = [
  { mime: "application/pdf", ext: ["pdf"], label: "PDF", emoji: "📄", read: "pdf" },
  { mime: "image/jpeg", ext: ["jpg", "jpeg"], label: "Photo", emoji: "🖼️", read: "image" },
  { mime: "image/png", ext: ["png"], label: "Photo", emoji: "🖼️", read: "image" },
  { mime: "image/webp", ext: ["webp"], label: "Photo", emoji: "🖼️", read: "image" },
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: ["docx"], label: "Word", emoji: "📝", read: "docx" },
  { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: ["pptx"], label: "PowerPoint", emoji: "📊", read: "pptx" },
  { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: ["xlsx"], label: "Excel", emoji: "📗", read: "sheet" },
  { mime: "application/vnd.ms-excel", ext: ["xls"], label: "Excel", emoji: "📗", read: "sheet" },
  { mime: "text/csv", ext: ["csv"], label: "CSV", emoji: "📗", read: "sheet" },
  { mime: "text/plain", ext: ["txt"], label: "Text", emoji: "📃", read: "text" },
];
export const ACCEPT = FILE_KINDS.map((k) => k.mime).concat(FILE_KINDS.flatMap((k) => k.ext.map((e) => `.${e}`))).join(",");
export const ACCEPT_LABEL = "PDF, photo, Word, PowerPoint, Excel, CSV or text";

/** The MIME to store: the browser's when it is one we know, else from the extension (Windows often sends CSV as Excel or nothing). */
export function resolveMime(name: string, browserType: string): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const byExt = FILE_KINDS.find((k) => k.ext.includes(ext));
  if (byExt) return byExt.mime;
  const byType = FILE_KINDS.find((k) => k.mime === browserType);
  return byType ? byType.mime : null;
}
export function fileKind(mime: string) {
  return FILE_KINDS.find((k) => k.mime === mime) ?? null;
}
export function fileEmoji(mime: string): string {
  return fileKind(mime)?.emoji ?? "📎";
}
export function extFor(mime: string): string {
  return fileKind(mime)?.ext[0] ?? "bin";
}
