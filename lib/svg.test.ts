import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "./svg";
import { sourcesFor } from "./videos";

describe("sanitizeSvg", () => {
  it("keeps a plain diagram and adds a viewBox from width/height", () => {
    const out = sanitizeSvg('<svg width="640" height="360"><rect x="0" y="0" width="10" height="10" fill="#fff"/><text x="5" y="5">hi</text></svg>');
    expect(out).toContain('viewBox="0 0 640 360"');
    expect(out).toContain("<rect");
    expect(out).not.toMatch(/<svg[^>]*\swidth=/);
  });
  it("strips scripts, handlers and external references", () => {
    const out = sanitizeSvg('<svg viewBox="0 0 10 10"><script>alert(1)</script><a href="https://x.y" onclick="evil()"><circle r="1"/></a><image href="https://x/y.png"/><rect style="fill:url(https://x)"/></svg>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("https://");
    expect(out).toContain("<circle");
  });
  it("rejects text that is not an svg and oversized input", () => {
    expect(sanitizeSvg("hello")).toBeNull();
    expect(sanitizeSvg(`<svg>${"x".repeat(30000)}</svg>`)).toBeNull();
  });
  it("takes only the svg out of surrounding prose", () => {
    expect(sanitizeSvg('Here you go:\n```svg\n<svg viewBox="0 0 1 1"></svg>\n```')).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>');
  });
});

describe("sourcesFor", () => {
  it("gives Arabic subjects Arabic channels and science subjects a science-heavy mix", () => {
    expect(sourcesFor("ar", "اللغة العربية").map((s) => s.id)).toEqual(["nafham", "madrasetna", "zakerly"]);
    expect(sourcesFor("en", "Chemistry").map((s) => s.id)).toEqual(["khan", "oct", "dave", "crash"]);
    expect(sourcesFor("en", "English").map((s) => s.id)).toEqual(["khan", "crash", "teded", "dave"]);
  });
});
