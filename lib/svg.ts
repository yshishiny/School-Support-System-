/**
 * Makes an AI-written SVG safe to inline: no scripts, no event handlers, no external references,
 * no foreign HTML. Pure string work so it can run on the server and be tested.
 */
const MAX_SVG_CHARS = 20_000;

export function sanitizeSvg(input: string): string | null {
  if (!input) return null;
  let s = input.trim();
  const start = s.indexOf("<svg");
  const end = s.lastIndexOf("</svg>");
  if (start < 0 || end < 0) return null;
  s = s.slice(start, end + 6);
  if (s.length > MAX_SVG_CHARS) return null;
  // Whole elements that never belong in a diagram.
  s = s.replace(/<\s*(script|foreignObject|iframe|object|embed|video|audio|animate|set|animateTransform|animateMotion)\b[\s\S]*?(<\/\s*\1\s*>|\/>)/gi, "");
  // Event handlers and javascript: / data: / external URLs.
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/\s(xlink:href|href)\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "");
  s = s.replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, "none");
  s = s.replace(/javascript:/gi, "");
  if (/<\s*(script|foreignObject|iframe)/i.test(s)) return null;
  // Make it scale to its box.
  if (!/viewBox=/i.test(s)) {
    const w = /width\s*=\s*"?(\d+)/i.exec(s)?.[1];
    const h = /height\s*=\s*"?(\d+)/i.exec(s)?.[1];
    if (w && h) s = s.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`);
  }
  s = s.replace(/<svg([^>]*?)\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "<svg$1");
  s = s.replace(/<svg([^>]*?)\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "<svg$1");
  if (!/xmlns=/.test(s)) s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return s;
}
