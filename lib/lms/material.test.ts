import { describe, expect, it } from "vitest";
import { countWords, materialFor, mediaLine, readVideos, readVisuals, videoKind, type HeldDetail, type LessonDetail } from "./material";

const lesson = (o: Partial<LessonDetail> = {}): LessonDetail => ({
  level: "basics", content_md: "# Title\n\nSome words here.", model: "m", created_at: "2026-09-01T00:00:00Z",
  checked_at: "2026-09-01T00:05:00Z", failed_checks: null, human_reviewed_at: null, human_note: null, ...o,
});

describe("videoKind", () => {
  it("counts a link with a video id as a video", () => {
    expect(videoKind({ video_id: "abc123", url: "x" })).toBe("video");
  });

  it("counts a watch url as a video even without an id field", () => {
    expect(videoKind({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })).toBe("video");
    expect(videoKind({ url: "https://youtu.be/dQw4w9WgXcQ" })).toBe("video");
  });

  it("calls a search url a search — this is the whole point", () => {
    // Every one of the 99 links stored so far looks like this.
    expect(videoKind({ video_id: null, url: "https://www.youtube.com/results?search_query=Khan%20Academy%20atoms" })).toBe("search");
  });

  it("treats a blank id as no id", () => {
    expect(videoKind({ video_id: "  ", url: "https://example.com" })).toBe("search");
  });
});

describe("readVisuals", () => {
  it("keeps only entries that actually carry an svg", () => {
    const got = readVisuals([{ svg: "<svg/>", title: "T", caption: "C" }, { title: "no svg" }, null]);
    expect(got).toEqual([{ svg: "<svg/>", title: "T", caption: "C" }]);
  });

  it("survives a non-array", () => {
    expect(readVisuals(null)).toEqual([]);
    expect(readVisuals({ svg: "<svg/>" })).toEqual([]);
  });

  it("falls back to a title rather than showing nothing", () => {
    expect(readVisuals([{ svg: "<svg/>" }])[0].title).toBe("Diagram");
  });
});

describe("readVideos", () => {
  it("drops an entry with no url, because there is nothing to open", () => {
    expect(readVideos([{ title: "x" }])).toEqual([]);
  });

  it("carries the kind through", () => {
    const got = readVideos([
      { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "real", channel: "c", source: "yt" },
      { url: "https://www.youtube.com/results?search_query=x", title: "hunt", video_id: null },
    ]);
    expect(got.map((v) => v.kind)).toEqual(["video", "search"]);
    expect(got[0].channel).toBe("c");
    expect(got[1].channel).toBeNull();
  });
});

describe("countWords", () => {
  it("counts words a reader would count, not markdown", () => {
    expect(countWords("# Heading\n\n- one **two** three")).toBe(4);
  });

  it("ignores code blocks, which nobody reads aloud", () => {
    expect(countWords("hello\n```\nlots of code in here\n```\nworld")).toBe(2);
  });

  it("is zero for nothing", () => {
    expect(countWords(null)).toBe(0);
    expect(countWords("")).toBe(0);
  });
});

describe("materialFor", () => {
  it("takes the newest lesson at that level", () => {
    const m = materialFor("basics", [
      lesson({ content_md: "old", created_at: "2026-01-01T00:00:00Z" }),
      lesson({ content_md: "new", created_at: "2026-06-01T00:00:00Z" }),
    ], []);
    expect(m.script).toBe("new");
  });

  it("does not mix levels", () => {
    const m = materialFor("advanced", [lesson({ level: "basics", content_md: "basics text" })], []);
    expect(m.script).toBeNull();
    expect(m.words).toBe(0);
  });

  it("reports a hold nobody has answered", () => {
    const held: HeldDetail[] = [{ level: "basics", blocking: ["too hard"], cleared_at: null, created_at: "2026-09-01T00:00:00Z" }];
    expect(materialFor("basics", [], held).heldOn).toEqual(["too hard"]);
  });

  it("ignores a hold that was already cleared — that is history, not a job", () => {
    const held: HeldDetail[] = [{ level: "basics", blocking: ["was wrong"], cleared_at: "2026-09-02T00:00:00Z", created_at: "2026-09-01T00:00:00Z" }];
    expect(materialFor("basics", [lesson()], held).heldOn).toBeNull();
  });

  it("keeps a stored lesson's warnings next to its text", () => {
    const m = materialFor("basics", [lesson({ failed_checks: ["reading age"] })], []);
    expect(m.warnings).toEqual(["reading age"]);
    expect(m.script).not.toBeNull();
  });
});

describe("mediaLine", () => {
  it("does not call a search a video", () => {
    const line = mediaLine([], readVideos([{ url: "https://www.youtube.com/results?search_query=x" }]));
    expect(line).toBe("no diagrams · 1 video search — nobody has checked these point at a real video");
  });

  it("says plainly when there is nothing", () => {
    expect(mediaLine([], [])).toBe("no diagrams · no videos");
  });

  it("counts real videos separately from searches", () => {
    const videos = readVideos([
      { url: "https://youtu.be/dQw4w9WgXcQ" },
      { url: "https://www.youtube.com/results?search_query=a" },
      { url: "https://www.youtube.com/results?search_query=b" },
    ]);
    const line = mediaLine(readVisuals([{ svg: "<svg/>" }]), videos);
    expect(line).toBe("1 diagram · 1 video · 2 video searches — nobody has checked these point at a real video");
  });
});
