import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { archiveStats, attachmentKind, parseArchiveText, parseArchiveZip, sampleForModel } from "./archive";

const IOS = `[10/09/2025, 8:15:32 AM] Ms Sara: Good morning, homework for tomorrow: math p.45 ex 1-10
[10/09/2025, 8:16:01 AM] Ms Sara: ‎<attached: 00000012-PHOTO-2025-09-10-08-16-01.jpg>
[11/09/2025, 3:05:10 PM] Parent A: Thank you`;
const ANDROID = `10/09/2025, 20:15 - Ms Sara: IMG-20250910-WA0001.jpg (file attached)
10/09/2025, 20:16 - Ms Sara: Science quiz Sunday chapter 2`;

describe("attachments", () => {
  it("classifies by extension", () => {
    expect(attachmentKind("a.JPG")).toBe("image");
    expect(attachmentKind("sheet.xlsx")).toBe("sheet");
    expect(attachmentKind("notes.pdf")).toBe("pdf");
    expect(attachmentKind("voice.opus")).toBe("audio");
  });
  it("links iOS and Android attachment references and strips them from the text", () => {
    const ios = parseArchiveText(IOS);
    expect(ios[1].attachmentName).toBe("00000012-PHOTO-2025-09-10-08-16-01.jpg");
    expect(ios[1].attachmentKind).toBe("image");
    expect(ios[1].text).toBe("");
    const android = parseArchiveText(ANDROID);
    expect(android[0].attachmentName).toBe("IMG-20250910-WA0001.jpg");
    expect(android[1].attachmentName).toBeNull();
  });
});

describe("parseArchiveZip", () => {
  it("finds the chat text and the media files", () => {
    const zip = zipSync({ "_chat.txt": strToU8(IOS), "00000012-PHOTO-2025-09-10-08-16-01.jpg": new Uint8Array([1, 2, 3]), "__MACOSX/._x": new Uint8Array([0]) });
    const parsed = parseArchiveZip(zip);
    expect(parsed.chatFileName).toBe("_chat.txt");
    expect(parsed.messages).toHaveLength(3);
    expect(parsed.files.map((f) => f.name)).toEqual(["00000012-PHOTO-2025-09-10-08-16-01.jpg"]);
  });
});

describe("archiveStats and sample", () => {
  it("counts senders, kinds and dates", () => {
    const stats = archiveStats(parseArchiveText(IOS));
    expect(stats.senders[0]).toEqual({ name: "Ms Sara", messages: 2, attachments: 1 });
    expect(stats.kinds).toEqual({ image: 1 });
    expect(stats.firstDate).toBe("2025-09-10");
    expect(stats.lastDate).toBe("2025-09-11");
    expect(stats.weekdays[3]).toBe(2); // 10 Sep 2025 is a Wednesday
  });
  it("marks attachments in the model sample", () => {
    expect(sampleForModel(parseArchiveText(IOS))).toContain("<image: 00000012-PHOTO");
  });
});
