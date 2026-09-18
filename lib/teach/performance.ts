/**
 * How a lesson script is performed on the stage: which gesture and camera each beat gets,
 * how the board reveals itself as the teacher speaks, and which mouth shape a word calls for.
 * Pure functions so the director stays small and this can be tested.
 */

export type Gesture = "idle" | "wave" | "explain" | "point" | "write" | "think" | "celebrate" | "listen" | "oops" | "bow";
export type Mood = "neutral" | "happy" | "think" | "surprised" | "encourage" | "sad";
export type Camera = "wide" | "board" | "teacher";
export type Viseme = "rest" | "small" | "open" | "wide" | "round" | "closed";

export interface BeatLike {
  kind: "hook" | "explain" | "example" | "check" | "recap";
  say: string;
  show?: { type: "text" | "steps" | "formula" | "table" | "svg"; content: string } | null;
  gesture?: Gesture | null;
  mood?: Mood | null;
}

const GESTURES: Gesture[] = ["idle", "wave", "explain", "point", "write", "think", "celebrate", "listen", "oops", "bow"];
const MOODS: Mood[] = ["neutral", "happy", "think", "surprised", "encourage", "sad"];

/** The gesture the teacher performs for a beat: the script's own if valid, else one that fits the beat kind. */
export function gestureFor(beat: BeatLike): Gesture {
  if (beat.gesture && GESTURES.includes(beat.gesture)) return beat.gesture;
  if (beat.kind === "hook") return "wave";
  if (beat.kind === "check") return "think";
  if (beat.kind === "recap") return "celebrate";
  if (beat.show && (beat.show.type === "steps" || beat.show.type === "formula" || beat.show.type === "table")) return "write";
  if (beat.show) return "point";
  return "explain";
}

export function moodFor(beat: BeatLike): Mood {
  if (beat.mood && MOODS.includes(beat.mood)) return beat.mood;
  if (beat.kind === "hook") return "happy";
  if (beat.kind === "check") return "think";
  if (beat.kind === "recap") return "encourage";
  return "neutral";
}

/** Where the camera sits: on the teacher for talk, on the board for content, wide for questions. */
export function cameraFor(beat: BeatLike): Camera {
  if (beat.kind === "check") return "wide";
  if (!beat.show) return beat.kind === "hook" || beat.kind === "recap" ? "teacher" : "wide";
  return beat.show.type === "text" ? "wide" : "board";
}

/** Does the teacher face the board while performing this beat? */
export function facesBoard(gesture: Gesture): boolean {
  return gesture === "write" || gesture === "point";
}

/** Words of a spoken line, for karaoke captions; keeps punctuation attached to its word. */
export function wordsOf(text: string): string[] {
  return text.split(/\s+/).map((w) => w.trim()).filter(Boolean);
}

/** Word index for a character offset (the boundary event gives charIndex). */
export function wordIndexAt(text: string, charIndex: number): number {
  let i = 0;
  let n = 0;
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > charIndex) break;
    i = n;
    n += 1;
  }
  return i;
}

/** The lines the board reveals for a visual; one entry per reveal step. */
export function boardLines(show: NonNullable<BeatLike["show"]>): string[] {
  if (show.type === "steps" || show.type === "table") return show.content.split("\n").map((l) => l.trim()).filter(Boolean);
  if (show.type === "text") return show.content.split("\n").map((l) => l.trim()).filter(Boolean);
  return [show.content];
}

/** How many board lines are visible when `spokenFraction` (0..1) of the beat has been said. Front-loaded so the board stays ahead of the voice. */
export function revealCount(lines: number, spokenFraction: number): number {
  if (lines <= 0) return 0;
  const f = Math.min(1, Math.max(0, spokenFraction));
  return Math.min(lines, Math.max(1, Math.ceil((f + 0.15) * lines)));
}

/** A mouth shape for a word, from its letters; the stage cycles shapes within the word. */
export function visemeFor(word: string, tick: number): Viseme {
  const w = word.toLowerCase().replace(/[^a-z؀-ۿ]/g, "");
  if (!w) return "rest";
  const letters = w.split("");
  const l = letters[Math.min(letters.length - 1, tick % Math.max(1, letters.length))];
  if ("mbp".includes(l) || "مب".includes(l)) return "closed";
  if ("ouw".includes(l) || "وُ".includes(l)) return "round";
  if ("aeiy".includes(l) || "اآأإيَ".includes(l)) return tick % 2 === 0 ? "open" : "wide";
  return tick % 3 === 0 ? "small" : "open";
}

/** Rough seconds a line takes to say, for timing when the browser has no voice. */
export function estimateSeconds(text: string, rate = 1): number {
  const words = wordsOf(text).length;
  return Math.max(1.2, (words / 2.6) / Math.max(0.6, rate));
}

/** Short label for the timeline strip. */
export function beatLabel(kind: BeatLike["kind"]): { emoji: string; label: string } {
  return { hook: { emoji: "✨", label: "Hook" }, explain: { emoji: "💡", label: "Explain" }, example: { emoji: "🧮", label: "Example" }, check: { emoji: "❓", label: "Check" }, recap: { emoji: "🏁", label: "Recap" } }[kind];
}
