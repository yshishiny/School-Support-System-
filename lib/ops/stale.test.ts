import { describe, expect, it } from "vitest";
import { looksStale } from "./stale";

describe("telling a stale page from a broken one", () => {
  it("calls a differing build stale however innocent the message looks", () => {
    // The real case: four of these were reported as bugs in /calendar and /coach/check, and the page was fine.
    expect(looksStale({ message: "u is not a function", pageBuild: "abc123", serverBuild: "def456" })).toBe(true);
  });

  it("calls a matching build a real fault however stale the message sounds", () => {
    expect(looksStale({ message: "Failed to find Server Action", pageBuild: "abc123", serverBuild: "abc123" })).toBe(false);
    expect(looksStale({ message: "u is not a function", pageBuild: "abc123", serverBuild: "abc123" })).toBe(false);
  });

  it("falls back to the phrases only when the running build is unknown", () => {
    expect(looksStale({ message: "Failed to find Server Action", pageBuild: "abc123", serverBuild: null })).toBe(true);
    expect(looksStale({ message: "Loading CSS chunk 42 failed", pageBuild: "abc123", serverBuild: null })).toBe(true);
    expect(looksStale({ message: "u is not a function", pageBuild: "abc123", serverBuild: null })).toBe(false);
  });

  it("treats a dev build like any other stamp", () => {
    expect(looksStale({ message: "boom", pageBuild: "dev", serverBuild: "dev" })).toBe(false);
  });
});
