import { describe, expect, it } from "vitest";
import { isFocusRoute } from "./parent-focus";

describe("isFocusRoute", () => {
  it("gives one child's page the whole width", () => {
    expect(isFocusRoute("/parent/trace/de140173-0ff2-4e6b-af8c-366ce15142bc")).toBe(true);
  });
  it("gives one child's prayers the whole width too", () => {
    expect(isFocusRoute("/parent/prayers/de140173-0ff2-4e6b-af8c-366ce15142bc")).toBe(true);
    expect(isFocusRoute("/parent/prayers")).toBe(false);
  });
  it("leaves the menu on the pages that list things", () => {
    expect(isFocusRoute("/parent/trace")).toBe(false);
    expect(isFocusRoute("/parent")).toBe(false);
    expect(isFocusRoute("/parent/allowance")).toBe(false);
  });
  it("does not match a deeper path by accident", () => {
    expect(isFocusRoute("/parent/trace/abc/week")).toBe(false);
  });
});
