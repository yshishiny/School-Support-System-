import { describe, it, expect } from "vitest";
import { parseWhatsAppExport, filterSince } from "./parse-export";

const android = `14/09/2026, 20:15 - Ms. Sarah (Math): Homework: page 45, exercises 1-10. Due Wednesday.
14/09/2026, 20:16 - Ms. Sarah (Math): Quiz on chapter 3
next Sunday
15/09/2026, 07:02 - Mr. Ahmed: <Media omitted>
15/09/2026, 07:03 - Mr. Ahmed: Bring your lab coats tomorrow`;

const ios = `[14/09/2026, 8:15:32 PM] Ms. Sarah: Homework: page 45
[14/09/2026, 8:16:01 PM] Ms. Sarah: image omitted
[15/09/2026, 7:03:10 AM] Mr. Ahmed: Lab coats tomorrow`;

describe("parseWhatsAppExport", () => {
  it("parses Android format with multi-line messages and drops media placeholders", () => {
    const msgs = parseWhatsAppExport(android);
    expect(msgs).toHaveLength(3);
    expect(msgs[0]).toMatchObject({ date: "2026-09-14", time: "20:15", sender: "Ms. Sarah (Math)" });
    expect(msgs[1].text).toBe("Quiz on chapter 3\nnext Sunday");
    expect(msgs[2].text).toBe("Bring your lab coats tomorrow");
  });
  it("parses iOS format with 12-hour clock", () => {
    const msgs = parseWhatsAppExport(ios);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].time).toBe("20:15");
    expect(msgs[1].time).toBe("07:03");
  });
  it("handles LRM characters and 2-digit years", () => {
    const msgs = parseWhatsAppExport("‎[3/9/26, 9:00:00 AM] Teacher: Hello");
    expect(msgs[0].date).toBe("2026-09-03");
  });
  it("filters by date", () => {
    const msgs = filterSince(parseWhatsAppExport(android), "2026-09-15");
    expect(msgs).toHaveLength(1);
  });
});
