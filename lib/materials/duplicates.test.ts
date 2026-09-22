import { describe, expect, it } from "vitest";
import { classify, overCap, skipLine, toUpload, type Candidate, type KnownFile } from "./duplicates";

const OMAR = "omar";
const YOUSSEF = "youssef";
const known = (over: Partial<KnownFile> = {}): KnownFile =>
  ({ id: "m1", sha: "aaa", studentId: OMAR, title: "Story Settings Description", createdAt: "2026-09-22T10:00:00Z", originalName: "beach.pdf", ...over });
const file = (name: string, sha: string, size = 1000): Candidate => ({ name, sha, size });
const nameOf = (id: string) => (id === OMAR ? "Omar" : "Youssef");

describe("classify", () => {
  it("calls a file nobody has new", () => {
    expect(classify([file("a.pdf", "zzz")], [], OMAR)[0].kind).toBe("new");
  });

  it("recognises the same bytes on the same child, whatever the file is called now", () => {
    // The parent renamed it on their phone; the bytes did not change.
    const v = classify([file("beach-copy.pdf", "aaa")], [known()], OMAR)[0];
    expect(v.kind).toBe("same_child");
  });

  it("does not confuse two different files that the model gave the same title", () => {
    // The real case: "Story Settings Description" was a beach worksheet and a haunted-house worksheet.
    const haunted = file("haunted.pdf", "bbb");
    expect(classify([haunted], [known({ sha: "aaa" })], OMAR)[0].kind).toBe("new");
  });

  it("separates a sibling's copy from this child's", () => {
    const v = classify([file("x.pdf", "aaa")], [known({ studentId: YOUSSEF })], OMAR)[0];
    expect(v.kind).toBe("other_child");
  });

  it("prefers this child's copy when both children have the file", () => {
    const v = classify([file("x.pdf", "aaa")], [known({ studentId: YOUSSEF, id: "m2" }), known({ studentId: OMAR, id: "m1" })], OMAR)[0];
    expect(v.kind).toBe("same_child");
  });

  it("catches the same file chosen twice in one batch", () => {
    const v = classify([file("a.pdf", "aaa"), file("a.pdf", "aaa")], [], OMAR);
    expect(v[0].kind).toBe("new");
    expect(v[1].kind).toBe("twice_in_batch");
  });

  it("catches one file chosen twice under two names", () => {
    const v = classify([file("beach.pdf", "aaa"), file("beach (1).pdf", "aaa")], [], OMAR);
    expect(v[1]).toMatchObject({ kind: "twice_in_batch", firstName: "beach.pdf" });
  });

  it("keeps the order the files were chosen in", () => {
    const v = classify([file("a", "1"), file("b", "2"), file("c", "3")], [], OMAR);
    expect(v.map((x) => x.name)).toEqual(["a", "b", "c"]);
  });
});

describe("toUpload", () => {
  it("skips only what this child already has, and the within-batch repeats", () => {
    const v = classify(
      [file("new.pdf", "zzz"), file("mine.pdf", "aaa"), file("sibling.pdf", "bbb"), file("new-again.pdf", "zzz")],
      [known({ sha: "aaa", studentId: OMAR }), known({ sha: "bbb", studentId: YOUSSEF, id: "m2" })],
      OMAR,
    );
    expect(toUpload(v).map((x) => x.name)).toEqual(["new.pdf", "sibling.pdf"]);
  });

  it("uploads a sibling's file for this child too — it is their copy, not a duplicate of theirs", () => {
    const v = classify([file("x.pdf", "aaa")], [known({ studentId: YOUSSEF })], OMAR);
    expect(toUpload(v)).toHaveLength(1);
  });
});

describe("skipLine", () => {
  it("says when it was sent and what it was called, and that it was not re-read", () => {
    const v = classify([file("beach-copy.pdf", "aaa")], [known()], OMAR)[0];
    const line = skipLine(v, nameOf)!;
    expect(line).toContain("2026-09-22");
    expect(line).toContain("Story Settings Description");
    expect(line).toContain("beach.pdf");
    expect(line).toContain("Not read again");
  });

  it("does not repeat the name when nothing was renamed", () => {
    const v = classify([file("beach.pdf", "aaa")], [known({ originalName: "beach.pdf" })], OMAR)[0];
    expect(skipLine(v, nameOf)).not.toContain("sent as");
  });

  it("survives a file uploaded before names were kept", () => {
    const v = classify([file("beach.pdf", "aaa")], [known({ originalName: null })], OMAR)[0];
    expect(skipLine(v, nameOf)).not.toContain("sent as");
  });

  it("names the sibling", () => {
    const v = classify([file("x.pdf", "aaa")], [known({ studentId: YOUSSEF })], OMAR)[0];
    expect(skipLine(v, nameOf)).toContain("Youssef");
  });

  it("says nothing about a file that is simply new", () => {
    expect(skipLine(classify([file("a", "1")], [], OMAR)[0], nameOf)).toBeNull();
  });
});

describe("overCap", () => {
  it("names what it will not take instead of dropping it", () => {
    // The bug: six were chosen, five were taken, and the sixth vanished without a word.
    const { taken, dropped } = overCap(["1", "2", "3", "4", "5", "6"], 5);
    expect(taken).toHaveLength(5);
    expect(dropped).toEqual(["6"]);
  });

  it("drops nothing when the choice fits", () => {
    expect(overCap(["1", "2"], 20).dropped).toEqual([]);
  });
});
