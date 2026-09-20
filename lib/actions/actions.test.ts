import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every export of a `"use server"` module is a public endpoint.
 *
 * Next.js gives each one an id and wires it to a route, so a helper that happens to live in an action file is
 * reachable by anyone who can POST — no page, no button, no auth. That is how `loadWallet`, `creditWallet` and
 * `loadAccess` came to take a child or a family from their caller and read and write with the service-role key.
 *
 * The convention that keeps it from happening again is that an action's name ends in `Action`. Anything else is a
 * helper and belongs in an ordinary module, where it can only be reached by code that has already established who
 * is asking. Types are exempt: they are erased before any of this exists.
 */
const DIR = join(process.cwd(), "lib/actions");

function serverModules(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .filter((f) => /^\s*["']use server["']/.test(readFileSync(join(DIR, f), "utf8")));
}

describe("server actions are the only exports of an action module", () => {
  const files = serverModules();

  it("finds the action modules", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files)("%s exports only *Action functions", (file) => {
    const src = readFileSync(join(DIR, file), "utf8");
    const exported = [...src.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map((m) => m[1]);
    expect(exported.filter((n) => !n.endsWith("Action"))).toEqual([]);
  });

  it("has no `export const` or re-export in an action module either", () => {
    for (const file of files) {
      const src = readFileSync(join(DIR, file), "utf8");
      expect([file, [...src.matchAll(/^export\s+(?!type\b|interface\b|async\s+function\b|function\b)(\w+)/gm)].map((m) => m[0])]).toEqual([file, []]);
    }
  });
});
