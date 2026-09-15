/**
 * Visual themes the boys can pick. Colours only: no club crests or trademarks,
 * just palettes and emoji so the app feels like theirs.
 */
export type ThemeGroup = "classic" | "club" | "career";

export interface Theme {
  id: string;
  name: string;
  group: ThemeGroup;
  emoji: string;
  tagline: string;
  vars: {
    bg: string;
    glow: string; // gradient highlight behind the top of the page
    panel: string;
    panel2: string;
    line: string;
    ink: string;
    muted: string;
    accent: string;
    accent2: string;
  };
  mono?: boolean;
  scene?: "pitch"; // soft watermark drawn behind the page
  stickers?: string[]; // cartoon emoji used as mascots around the pages
}

export const THEMES: Theme[] = [
  { id: "default", name: "Galaxy", group: "classic", stickers: ["🪐", "🚀", "⭐", "🛸"], emoji: "🪐", tagline: "Level up every day", vars: { bg: "#0b1020", glow: "#1d1a4a", panel: "#141b2f", panel2: "#1b2440", line: "#263252", ink: "#e8ecf8", muted: "#8b95b5", accent: "#7c5cff", accent2: "#22d3ee" } },
  { id: "ocean", name: "Ocean", group: "classic", stickers: ["🐬", "🐠", "🌊", "🐙"], emoji: "🌊", tagline: "Deep focus", vars: { bg: "#05141f", glow: "#0b3a5b", panel: "#0d2233", panel2: "#123047", line: "#1e4360", ink: "#e6f4ff", muted: "#7fa6c2", accent: "#0ea5e9", accent2: "#5eead4" } },
  { id: "sunset", name: "Sunset", group: "classic", stickers: ["🌅", "🦩", "🍉", "🏄"], emoji: "🌅", tagline: "Bright and bold", vars: { bg: "#1a0b14", glow: "#5b1d3a", panel: "#2a1220", panel2: "#3a1a2c", line: "#55273f", ink: "#fff0f5", muted: "#c48ba5", accent: "#f97316", accent2: "#f43f5e" } },

  { id: "madrid", name: "Los Blancos", group: "club", stickers: ["👑", "⚽", "🏆", "🥅"], scene: "pitch", emoji: "👑", tagline: "Hala Madrid", vars: { bg: "#0b1330", glow: "#1e2a6b", panel: "#121c44", panel2: "#19255a", line: "#2a3a7a", ink: "#f7f8ff", muted: "#9aa6d8", accent: "#febe10", accent2: "#ffffff" } },
  { id: "barca", name: "Blaugrana", group: "club", stickers: ["⚽", "🎯", "🏟️", "🥇"], scene: "pitch", emoji: "🔵🔴", tagline: "Més que un club", vars: { bg: "#0e1030", glow: "#2b1050", panel: "#171a4a", panel2: "#1f2260", line: "#33367d", ink: "#f6f3ff", muted: "#a6a3d6", accent: "#a50044", accent2: "#edbb00" } },
  { id: "liverpool", name: "The Reds", group: "club", stickers: ["⚽", "🔴", "🎺", "🏆"], scene: "pitch", emoji: "🔴", tagline: "You'll never walk alone", vars: { bg: "#1c0606", glow: "#5a0d12", panel: "#2b0b0d", panel2: "#3a1013", line: "#58191e", ink: "#fff3f3", muted: "#d09a9e", accent: "#c8102e", accent2: "#00b2a9" } },
  { id: "city", name: "Sky Blues", group: "club", stickers: ["⚽", "🩵", "🏟️", "🏆"], scene: "pitch", emoji: "🩵", tagline: "Pride in battle", vars: { bg: "#08202e", glow: "#144a66", panel: "#0f2e40", panel2: "#153c52", line: "#215269", ink: "#eefaff", muted: "#8fb9cc", accent: "#6cabdd", accent2: "#ffffff" } },
  { id: "ahly", name: "Red Devils of Cairo", group: "club", stickers: ["🦅", "⚽", "🔴", "🏆"], scene: "pitch", emoji: "🦅", tagline: "Al Ahly forever", vars: { bg: "#1f0707", glow: "#6a0f16", panel: "#300c0e", panel2: "#421114", line: "#5f1c20", ink: "#fff5f5", muted: "#d4a0a3", accent: "#e0101f", accent2: "#ffd700" } },
  { id: "zamalek", name: "White Knights", group: "club", stickers: ["⚪", "⚽", "🏰", "🏆"], scene: "pitch", emoji: "⚪", tagline: "Zamalek pride", vars: { bg: "#111318", glow: "#3a0e12", panel: "#1b1e26", panel2: "#242833", line: "#343947", ink: "#f8f8fa", muted: "#a2a7b6", accent: "#e51b23", accent2: "#ffffff" } },
  { id: "psg", name: "Paris", group: "club", stickers: ["🗼", "⚽", "🔵", "🏆"], scene: "pitch", emoji: "🗼", tagline: "Ici c'est Paris", vars: { bg: "#08122b", glow: "#10306b", panel: "#0f1d40", panel2: "#152754", line: "#233a72", ink: "#f3f6ff", muted: "#98a8d8", accent: "#da291c", accent2: "#ffffff" } },
  { id: "bayern", name: "Bavaria", group: "club", stickers: ["⭐", "⚽", "🥨", "🏆"], scene: "pitch", emoji: "⭐", tagline: "Mia san mia", vars: { bg: "#220810", glow: "#6a0f22", panel: "#33101a", panel2: "#451625", line: "#642235", ink: "#fff4f6", muted: "#d19aaa", accent: "#dc052d", accent2: "#0066b2" } },

  { id: "engineer", name: "Engineer", group: "career", stickers: ["⚙️", "🔧", "🏗️", "🤖"], emoji: "⚙️", tagline: "Build the future", vars: { bg: "#15120a", glow: "#4a3410", panel: "#221c10", panel2: "#2e2616", line: "#463a22", ink: "#fff8e8", muted: "#bfae8a", accent: "#ff9f1c", accent2: "#ffd166" } },
  { id: "cyber", name: "Cybersecurity", group: "career", stickers: ["🛡️", "🔐", "👾", "🕵️"], emoji: "🛡️", tagline: "Access granted", mono: true, vars: { bg: "#040a05", glow: "#0a2a12", panel: "#0a160c", panel2: "#0f2012", line: "#1d3a22", ink: "#d8ffe6", muted: "#6fa87e", accent: "#00ff88", accent2: "#39ff14" } },
  { id: "doctor", name: "Doctor", group: "career", stickers: ["🩺", "💊", "🧬", "🚑"], emoji: "🩺", tagline: "Care and precision", vars: { bg: "#061e1c", glow: "#0f4f49", panel: "#0c2d2a", panel2: "#113c38", line: "#1c5551", ink: "#ecfeff", muted: "#87bdb8", accent: "#2dd4bf", accent2: "#f0fdfa" } },
  { id: "surgeon", name: "Surgeon", group: "career", stickers: ["🏥", "🩻", "🧤", "❤️‍🩹"], emoji: "🏥", tagline: "Steady hands", vars: { bg: "#0b1a22", glow: "#12405a", panel: "#102834", panel2: "#153545", line: "#224d60", ink: "#eef9ff", muted: "#8db6c9", accent: "#38bdf8", accent2: "#a5f3fc" } },
  { id: "pilot", name: "Pilot", group: "career", stickers: ["✈️", "🧭", "🌤️", "🛫"], emoji: "✈️", tagline: "Cleared for takeoff", vars: { bg: "#081a33", glow: "#11397a", panel: "#0f2648", panel2: "#15315c", line: "#22467c", ink: "#f0f6ff", muted: "#93aad4", accent: "#38bdf8", accent2: "#fbbf24" } },
  { id: "astronaut", name: "Astronaut", group: "career", stickers: ["🚀", "🌙", "🪐", "👨‍🚀"], emoji: "🚀", tagline: "To the stars", vars: { bg: "#05010f", glow: "#2a0f5e", panel: "#120a2a", panel2: "#1a1040", line: "#2d1f5e", ink: "#f5f0ff", muted: "#a596d0", accent: "#a78bfa", accent2: "#f472b6" } },
  { id: "coder", name: "Software Engineer", group: "career", stickers: ["💻", "🐙", "🧩", "⚡"], emoji: "💻", tagline: "Ship it", mono: true, vars: { bg: "#0f172a", glow: "#1e3a5f", panel: "#1e293b", panel2: "#273449", line: "#3b4a63", ink: "#f1f5f9", muted: "#94a3b8", accent: "#38bdf8", accent2: "#a3e635" } },
  { id: "architect", name: "Architect", group: "career", stickers: ["📐", "🏛️", "🧱", "🏙️"], emoji: "📐", tagline: "Design it right", vars: { bg: "#1c1917", glow: "#4a3a2a", panel: "#292524", panel2: "#332e2c", line: "#4a423f", ink: "#fafaf9", muted: "#a8a29e", accent: "#f59e0b", accent2: "#e7e5e4" } },
  { id: "scientist", name: "Scientist", group: "career", stickers: ["🧪", "🔬", "🧫", "💡"], emoji: "🧪", tagline: "Test everything", vars: { bg: "#0a1a12", glow: "#0f4a30", panel: "#10281c", panel2: "#153526", line: "#204d38", ink: "#effff6", muted: "#8cc4a4", accent: "#4ade80", accent2: "#c084fc" } },
];

export function themeById(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** A football pitch, portrait, drawn in thin light lines. Blurred and faded by CSS so it feels soft ("fluffy"). */
function pitchSvg(stroke: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 640" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round">
<rect x="20" y="20" width="360" height="600" rx="6"/>
<line x1="20" y1="320" x2="380" y2="320"/>
<circle cx="200" cy="320" r="56"/><circle cx="200" cy="320" r="3" fill="${stroke}"/>
<rect x="80" y="20" width="240" height="110"/><rect x="140" y="20" width="120" height="40"/>
<circle cx="200" cy="96" r="3" fill="${stroke}"/><path d="M150 130 A56 56 0 0 0 250 130"/>
<rect x="80" y="510" width="240" height="110"/><rect x="140" y="580" width="120" height="40"/>
<circle cx="200" cy="544" r="3" fill="${stroke}"/><path d="M150 510 A56 56 0 0 1 250 510"/>
<path d="M20 34 A14 14 0 0 0 34 20"/><path d="M366 20 A14 14 0 0 0 380 34"/><path d="M20 606 A14 14 0 0 1 34 620"/><path d="M366 620 A14 14 0 0 1 380 606"/>
</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** CSS custom properties for a theme, applied inline on the page wrapper. */
export function themeStyle(t: Theme): Record<string, string> {
  return {
    "--color-bg": t.vars.bg,
    "--theme-glow": t.vars.glow,
    "--color-panel": t.vars.panel,
    "--color-panel-2": t.vars.panel2,
    "--color-line": t.vars.line,
    "--color-ink": t.vars.ink,
    "--color-muted": t.vars.muted,
    "--color-accent": t.vars.accent,
    "--color-accent-2": t.vars.accent2,
    ...(t.mono ? { "--font-sans": 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' } : {}),
    ...(t.scene === "pitch" ? { "--theme-scene": pitchSvg(t.vars.accent2 === "#ffffff" ? "#ffffff" : t.vars.ink) } : {}),
  };
}
