import { describe, expect, it } from "vitest";
import { resolveMime, fileEmoji, extFor } from "./files";
import { extractText } from "./extract-text";
import { zipSync, strToU8 } from "fflate";
import * as XLSX from "xlsx";

describe("school file types", () => {
  it("resolves the MIME from the extension first, then the browser type", () => {
    expect(resolveMime("notes.docx", "")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(resolveMime("grades.csv", "application/vnd.ms-excel")).toBe("text/csv");
    expect(resolveMime("scan", "image/jpeg")).toBe("image/jpeg");
    expect(resolveMime("thing.exe", "application/octet-stream")).toBeNull();
    expect(fileEmoji("text/csv")).toBe("📗");
    expect(extFor("application/pdf")).toBe("pdf");
  });
  it("pulls the paragraphs out of a Word file and the slides out of a PowerPoint", () => {
    const docx = zipSync({ "word/document.xml": strToU8('<w:document><w:body><w:p><w:r><w:t>Unit 3:</w:t></w:r><w:r><w:t xml:space="preserve"> slope &amp; intercept</w:t></w:r></w:p><w:p><w:r><w:t>Homework p. 42</w:t></w:r></w:p></w:body></w:document>') });
    expect(extractText(Buffer.from(docx), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("Unit 3: slope & intercept\nHomework p. 42");
    const pptx = zipSync({ "ppt/slides/slide2.xml": strToU8("<p:sld><a:p><a:r><a:t>Second</a:t></a:r></a:p></p:sld>"), "ppt/slides/slide1.xml": strToU8("<p:sld><a:p><a:r><a:t>Photosynthesis</a:t></a:r></a:p></p:sld>") });
    expect(extractText(Buffer.from(pptx), "application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe("--- Slide 1 ---\nPhotosynthesis\n\n--- Slide 2 ---\nSecond");
  });
  it("turns a sheet and a CSV into rows, and passes text through", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Subject", "Grade"], ["Math", 92]]), "Term 1");
    const xlsx = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    expect(extractText(Buffer.from(xlsx), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("Subject,Grade\nMath,92");
    expect(extractText(Buffer.from("a,b\n1,2"), "text/csv")).toBe("a,b\n1,2");
    expect(extractText(Buffer.from("hello\r\nworld "), "text/plain")).toBe("hello\nworld");
    expect(extractText(Buffer.from("x"), "application/pdf")).toBeNull();
    expect(() => extractText(Buffer.from(zipSync({ "word/document.xml": strToU8("<w:document/>") })), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toThrow(/no readable text/);
  });
});
