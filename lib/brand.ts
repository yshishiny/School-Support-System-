import { APP_VERSION } from "./version";

/**
 * The beta shares a database with the live site, so the two must never be confused on a phone: the beta carries
 * its own name, its own icon and its own colour, from the home screen down to the page background.
 */
export interface Brand {
  beta: boolean;
  name: string;
  shortName: string;
  /** The tint of the whole app: what the accent variable becomes. */
  accent: string;
  accent2: string;
  /** Page background and the browser's own chrome. */
  bg: string;
  themeColor: string;
  /** The glyph in the icon and beside the version. */
  glyph: string;
  label: string;
}

const LIVE: Brand = { beta: false, name: "Study Portal", shortName: "Study Portal", accent: "#7c5cff", accent2: "#22d3ee", bg: "#0b1020", themeColor: "#0b1020", glyph: "📚", label: "live" };
const BETA: Brand = { beta: true, name: "Study Portal Beta", shortName: "Portal Beta", accent: "#d9b061", accent2: "#7bdff2", bg: "#0a0b12", themeColor: "#0a0b12", glyph: "🧪", label: "beta" };

/** Which site this deployment is. The branch decides on Vercel; the version string is the fallback elsewhere. */
export function isBeta(): boolean {
  const ref = process.env.VERCEL_GIT_COMMIT_REF ?? "";
  if (ref) return ref !== "main";
  return APP_VERSION.includes("beta");
}

export function brand(): Brand {
  return isBeta() ? BETA : LIVE;
}

/** The app icon, drawn rather than stored, so the beta's is a different colour without a second set of files. */
export function iconSvg(b: Brand, size = 64): string {
  const r = Math.round(size * 0.22);
  const id = `g-${b.label}`; // unique, so two of these on one page keep their own colours
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`
    + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b.accent}"/><stop offset="1" stop-color="${b.accent2}"/></linearGradient></defs>`
    + `<rect width="${size}" height="${size}" rx="${r}" fill="url(#${id})"/>`
    + `<text x="50%" y="${Math.round(size * 0.68)}" font-size="${Math.round(size * 0.53)}" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${b.glyph}</text>`
    + `</svg>`;
}

/** The colour overrides the beta puts on the page, as inline custom properties. */
export function brandVars(b: Brand): Record<string, string> {
  return b.beta ? { "--color-accent": b.accent, "--color-accent-2": b.accent2, "--color-bg": b.bg } : {};
}
