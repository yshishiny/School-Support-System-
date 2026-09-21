import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_VERSION, buildId } from "./version";

const root = path.resolve(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");
const pkg = JSON.parse(read("package.json")) as { version: string };

/**
 * These tests exist because the version was written down twice and the two copies drifted fifteen releases
 * apart. Nothing failed, nothing warned; every screen simply told a parent it was running a build from the week
 * before, and on the live site the stale string was being read as "this deployment is the beta".
 */
describe("there is one place the version is written", () => {
  it("is package.json, and it is a real version", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });

  it("is not written again in lib/version.ts", () => {
    const src = read("lib/version.ts");
    const assignment = src.match(/export const APP_VERSION\s*=\s*(.+)/)?.[1] ?? "";
    expect(assignment).toContain("NEXT_PUBLIC_APP_VERSION");
    // The only version-shaped literal allowed on that line is the deliberately unreleasable fallback: a real
    // number pasted back in here is exactly how the two copies drifted apart the first time.
    const literals = [...assignment.matchAll(/["\'`]([^"\'`]*)["\'`]/g)].map((m) => m[1]);
    expect(literals.filter((l) => /^\d+\.\d+\.\d+/.test(l))).toEqual(["0.0.0-dev"]);
  });

  it("is carried into the bundle by next.config.ts, read from package.json", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toMatch(/package\.json/);
    expect(cfg).toMatch(/NEXT_PUBLIC_APP_VERSION/);
    expect(cfg).not.toMatch(/NEXT_PUBLIC_APP_VERSION:\s*["'`]/); // never a literal
  });

  it("falls back visibly rather than silently when the build did not inject it", () => {
    // Under vitest nothing injects the variable, so this is the fallback path: it must be obviously not a
    // release, so a screen showing it cannot be mistaken for a real version.
    expect(APP_VERSION).toBe(process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0-dev");
    if (!process.env.NEXT_PUBLIC_APP_VERSION) expect(APP_VERSION).toContain("dev");
  });
});

describe("no other file pins a version of its own", () => {
  it("keeps the changelog's newest entry in step with the package", () => {
    const first = read("CHANGELOG.md").split("\n").find((l) => l.startsWith("## "));
    expect(first).toContain(pkg.version);
  });
});

describe("buildId", () => {
  it("is short enough to print beside a version", () => {
    expect(buildId().length).toBeLessThanOrEqual(7);
  });
});
