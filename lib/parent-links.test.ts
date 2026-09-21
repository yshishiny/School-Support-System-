import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

/** Every route the app serves, as a list of segment patterns. A "[x]" segment matches anything. */
function routes(): string[][] {
  const out: string[][] = [];
  const walk = (dir: string, segs: string[]) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        // (groups) do not appear in the URL; @slots are not routes.
        if (entry.startsWith("@")) continue;
        walk(full, entry.startsWith("(") && entry.endsWith(")") ? segs : [...segs, entry]);
      } else if (entry === "page.tsx" || entry === "route.ts") {
        out.push(segs);
      }
    }
  };
  walk(path.join(root, "app"), []);
  return out;
}

function resolves(href: string, all: string[][]): boolean {
  const clean = href.split("?")[0].split("#")[0];
  if (clean === "" || clean.startsWith("#")) return true; // an anchor on the page itself
  const want = clean.split("/").filter(Boolean);
  return all.some((r) => r.length === want.length && r.every((seg, i) => (seg.startsWith("[") ? true : seg === want[i])));
}

/** The hrefs written in one file, with `${...}` interpolations reduced to a single matchable segment. */
function hrefsIn(file: string): string[] {
  const src = readFileSync(path.join(root, file), "utf8");
  return [...src.matchAll(/href=(?:"([^"]+)"|\{`([^`]+)`\})/g)]
    .map((m) => (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, "x"))
    .filter((h) => !h.startsWith("http"));
}

/**
 * Every title on the child's page is a door. A door that opens onto nothing is the complaint that started all
 * of this — a row that looked clickable and did nothing — so the links are checked against the routes that
 * actually exist rather than against memory.
 */
describe("every link on the child's page goes somewhere", () => {
  const all = routes();

  it("found the app's routes at all", () => {
    expect(all.length).toBeGreaterThan(20);
    expect(all.some((r) => r.join("/") === "parent/trace/[id]")).toBe(true);
  });

  it("resolves every href on the child page", () => {
    const bad = hrefsIn("app/parent/trace/[id]/page.tsx").filter((h) => !resolves(h, all));
    expect(bad).toEqual([]);
  });

  it("resolves every href on the chooser and the parent home", () => {
    for (const f of ["app/parent/trace/page.tsx", "app/parent/page.tsx", "components/parent-home/Layouts.tsx"]) {
      expect({ file: f, bad: hrefsIn(f).filter((h) => !resolves(h, all)) }).toEqual({ file: f, bad: [] });
    }
  });

  it("resolves every section in the parent menu", () => {
    const menu = readFileSync(path.join(root, "lib/parent-sections.ts"), "utf8");
    const bad = [...menu.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]).filter((h) => !resolves(h, all));
    expect(bad).toEqual([]);
  });

  it("would catch a link to a page that does not exist", () => {
    expect(resolves("/parent/nowhere", all)).toBe(false);
    expect(resolves("/parent/trace", all)).toBe(true);
    expect(resolves("/parent/clinician/x", all)).toBe(true); // the [studentId] segment
  });
});
