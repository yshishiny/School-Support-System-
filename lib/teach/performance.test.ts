import { describe, expect, it } from "vitest";
import { boardLines, cameraFor, estimateSeconds, facesBoard, gestureFor, moodFor, revealCount, visemeFor, wordIndexAt, wordsOf } from "./performance";

describe("gestures and camera", () => {
  it("uses the script's gesture when valid, else infers from the beat", () => {
    expect(gestureFor({ kind: "explain", say: "x", gesture: "celebrate" })).toBe("celebrate");
    expect(gestureFor({ kind: "explain", say: "x", gesture: "dance" as never })).toBe("explain");
    expect(gestureFor({ kind: "hook", say: "x" })).toBe("wave");
    expect(gestureFor({ kind: "check", say: "x" })).toBe("think");
    expect(gestureFor({ kind: "recap", say: "x" })).toBe("celebrate");
    expect(gestureFor({ kind: "example", say: "x", show: { type: "steps", content: "1\n2" } })).toBe("write");
    expect(gestureFor({ kind: "explain", say: "x", show: { type: "svg", content: "<svg/>" } })).toBe("point");
  });
  it("points the camera at the board only for real content", () => {
    expect(cameraFor({ kind: "explain", say: "x", show: { type: "formula", content: "a²" } })).toBe("board");
    expect(cameraFor({ kind: "explain", say: "x", show: { type: "text", content: "hi" } })).toBe("wide");
    expect(cameraFor({ kind: "hook", say: "x" })).toBe("teacher");
    expect(cameraFor({ kind: "recap", say: "x", show: { type: "table", content: "a | b" } })).toBe("board");
    expect(cameraFor({ kind: "check", say: "x" })).toBe("wide");
  });
  it("faces the board while writing or pointing", () => {
    expect(facesBoard("write")).toBe(true);
    expect(facesBoard("explain")).toBe(false);
  });
  it("moods follow the beat kind", () => {
    expect(moodFor({ kind: "hook", say: "" })).toBe("happy");
    expect(moodFor({ kind: "check", say: "" })).toBe("think");
    expect(moodFor({ kind: "explain", say: "", mood: "surprised" })).toBe("surprised");
  });
});

describe("captions and board reveal", () => {
  it("splits words and maps a char offset to its word", () => {
    const t = "Course set. Let's go now";
    expect(wordsOf(t)).toEqual(["Course", "set.", "Let's", "go", "now"]);
    expect(wordIndexAt(t, 0)).toBe(0);
    expect(wordIndexAt(t, 7)).toBe(1);
    expect(wordIndexAt(t, 12)).toBe(2);
    expect(wordIndexAt(t, 999)).toBe(4);
  });
  it("reveals the board ahead of the voice, never past the end", () => {
    expect(revealCount(4, 0)).toBe(1);
    expect(revealCount(4, 0.5)).toBe(3);
    expect(revealCount(4, 1)).toBe(4);
    expect(revealCount(0, 1)).toBe(0);
  });
  it("lists board lines per visual type", () => {
    expect(boardLines({ type: "steps", content: "1. a\n\n2. b" })).toEqual(["1. a", "2. b"]);
    expect(boardLines({ type: "formula", content: "E = mc²" })).toEqual(["E = mc²"]);
  });
  it("estimates speech time from word count and rate", () => {
    expect(estimateSeconds("one two three four five six", 1)).toBeCloseTo(2.31, 1);
    expect(estimateSeconds("", 1)).toBe(1.2);
  });
});

describe("visemes", () => {
  it("closes on lips letters, rounds on o/u, opens on vowels", () => {
    expect(visemeFor("mum", 0)).toBe("closed");
    expect(visemeFor("oo", 0)).toBe("round");
    expect(visemeFor("a", 0)).toBe("open");
    expect(visemeFor("a", 1)).toBe("wide");
    expect(visemeFor("!!", 0)).toBe("rest");
    expect(visemeFor("مرحبا", 0)).toBe("closed");
  });
});
