/**
 * Plain text out of Word, PowerPoint, Excel, CSV and text files, so the reader can work from it.
 * Office files are zips of XML: fflate unzips, a small regex pass keeps the text runs. Sheets go through SheetJS.
 */
import { unzipSync, strFromU8 } from "fflate";
import * as XLSX from "xlsx";
import { fileKind } from "./files";

const MAX_CHARS = 60_000;

function decodeXml(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");
}

function docxText(buf: Uint8Array): string {
  const files = unzipSync(buf);
  const xml = files["word/document.xml"] ? strFromU8(files["word/document.xml"]) : "";
  const paras = xml.split(/<\/w:p>/).map((p) => decodeXml((p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join(""))).filter((p) => p.trim());
  return paras.join("\n");
}

function pptxText(buf: Uint8Array): string {
  const files = unzipSync(buf);
  const slides = Object.keys(files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  return slides
    .map((n, i) => {
      const xml = strFromU8(files[n]);
      const paras = xml.split(/<\/a:p>/).map((p) => decodeXml((p.match(/<a:t>([^<]*)<\/a:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join(""))).filter((p) => p.trim());
      return `--- Slide ${i + 1} ---\n${paras.join("\n")}`;
    })
    .join("\n\n");
}

function sheetText(buf: Uint8Array, mime: string): string {
  const wb = mime === "text/csv" ? XLSX.read(strFromU8(buf), { type: "string" }) : XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false });
    return wb.SheetNames.length > 1 ? `--- Sheet: ${name} ---\n${csv}` : csv;
  }).join("\n\n");
}

/** Returns text for a file the model cannot take as a document; null for PDFs and images (sent as they are). */
export function extractText(buf: Buffer, mime: string): string | null {
  const kind = fileKind(mime)?.read;
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  let text: string | null = null;
  if (kind === "docx") text = docxText(u8);
  else if (kind === "pptx") text = pptxText(u8);
  else if (kind === "sheet") text = sheetText(u8, mime);
  else if (kind === "text") text = strFromU8(u8);
  if (text === null) return null;
  text = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!text) throw new Error("The file has no readable text (a scanned image inside Word or a picture-only slide). Save it as PDF or a photo instead.");
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n\n[… cut after ${MAX_CHARS} characters]` : text;
}
