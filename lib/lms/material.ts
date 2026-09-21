/**
 * One topic's material, shaped for a person who is about to read it.
 *
 * The coverage list answers "does this exist". This answers "is it any good", which needs the actual text, the
 * actual diagrams and the actual links in front of you. Two things it refuses to flatten:
 *
 * - A **video** and a *search for a video* are not the same thing. Every one of the 99 links stored so far is a
 *   YouTube search URL with no video id, which means no one has ever confirmed a video is on the other end.
 *   Counting those as videos would tell a parent the topic is illustrated when it is not.
 * - A lesson that failed a check but was stored anyway carries its warnings here, next to the text they are
 *   about, rather than as a number somewhere else.
 */

export type VideoKind = "video" | "search";

export interface Visual { title: string; caption: string; svg: string }
export interface Video { title: string; url: string; channel: string | null; source: string | null; kind: VideoKind }

export interface Material {
  level: "basics" | "advanced";
  /** null when nothing was ever written at this level. */
  script: string | null;
  words: number;
  model: string | null;
  writtenAt: string | null;
  checkedAt: string | null;
  warnings: string[];
  reviewedAt: string | null;
  reviewedNote: string | null;
  /** A held attempt at this level that nobody has answered. */
  heldOn: string[] | null;
}

/** A link is only a video if it names one. A search URL is a promise, not a resource. */
export function videoKind(v: { video_id?: unknown; url?: unknown }): VideoKind {
  if (typeof v.video_id === "string" && v.video_id.trim() !== "") return "video";
  const url = typeof v.url === "string" ? v.url : "";
  return /[?&]v=[\w-]{6,}/.test(url) || /youtu\.be\/[\w-]{6,}/.test(url) ? "video" : "search";
}

export function readVisuals(raw: unknown): Visual[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const svg = typeof o.svg === "string" ? o.svg : "";
    if (!svg) return [];
    return [{
      title: typeof o.title === "string" ? o.title : "Diagram",
      caption: typeof o.caption === "string" ? o.caption : "",
      svg,
    }];
  });
}

export function readVideos(raw: unknown): Video[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url : "";
    if (!url) return [];
    return [{
      title: typeof o.title === "string" ? o.title : url,
      url,
      channel: typeof o.channel === "string" ? o.channel : null,
      source: typeof o.source === "string" ? o.source : null,
      kind: videoKind(o),
    }];
  });
}

/** Words as a reader counts them, which is the only measure of a script that means anything here. */
export function countWords(script: string | null): number {
  if (!script) return 0;
  const bare = script.replace(/```[\s\S]*?```/g, " ").replace(/[#*_>|`-]/g, " ");
  return bare.split(/\s+/).filter(Boolean).length;
}

export interface LessonDetail {
  level: string;
  content_md: string | null;
  model: string | null;
  created_at: string;
  checked_at: string | null;
  failed_checks: string[] | null;
  human_reviewed_at: string | null;
  human_note: string | null;
}

export interface HeldDetail { level: string; blocking: string[] | null; cleared_at: string | null; created_at: string }

export function materialFor(level: "basics" | "advanced", lessons: LessonDetail[], held: HeldDetail[]): Material {
  const l = lessons.filter((x) => x.level === level).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const h = held.filter((x) => x.level === level && !x.cleared_at).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    level,
    script: l?.content_md ?? null,
    words: countWords(l?.content_md ?? null),
    model: l?.model ?? null,
    writtenAt: l?.created_at ?? null,
    checkedAt: l?.checked_at ?? null,
    warnings: l?.failed_checks ?? [],
    reviewedAt: l?.human_reviewed_at ?? null,
    reviewedNote: l?.human_note ?? null,
    heldOn: h ? h.blocking ?? [] : null,
  };
}

/** What a person should be told about this topic's media in one line, without flattering it. */
export function mediaLine(visuals: Visual[], videos: Video[]): string {
  const real = videos.filter((v) => v.kind === "video").length;
  const searches = videos.length - real;
  const bits: string[] = [];
  bits.push(visuals.length === 0 ? "no diagrams" : `${visuals.length} diagram${visuals.length === 1 ? "" : "s"}`);
  if (real > 0) bits.push(`${real} video${real === 1 ? "" : "s"}`);
  if (searches > 0) bits.push(`${searches} video search${searches === 1 ? "" : "es"} — nobody has checked these point at a real video`);
  if (real === 0 && searches === 0) bits.push("no videos");
  return bits.join(" · ");
}
