import { report } from "@/lib/ops/fault";
/**
 * Video lessons from several channels ("different areas"), so a topic is never explained by one voice only.
 * With YOUTUBE_API_KEY set, each source becomes a real, embeddable video; without it, a search link per source.
 */
export interface VideoSource { id: string; label: string; language: "en" | "ar"; query: string; kind: "channel" | "style" }

export const VIDEO_SOURCES: VideoSource[] = [
  { id: "khan", label: "Khan Academy", language: "en", query: "Khan Academy", kind: "channel" },
  { id: "crash", label: "CrashCourse", language: "en", query: "CrashCourse", kind: "channel" },
  { id: "dave", label: "Professor Dave Explains", language: "en", query: "Professor Dave Explains", kind: "channel" },
  { id: "oct", label: "The Organic Chemistry Tutor", language: "en", query: "The Organic Chemistry Tutor", kind: "channel" },
  { id: "teded", label: "TED-Ed", language: "en", query: "TED-Ed", kind: "channel" },
  { id: "animated", label: "Animated explainer", language: "en", query: "animated explanation for students", kind: "style" },
  { id: "nafham", label: "نفهم", language: "ar", query: "نفهم", kind: "channel" },
  { id: "madrasetna", label: "مدرستنا (وزارة التربية والتعليم)", language: "ar", query: "قناة مدرستنا", kind: "channel" },
  { id: "zakerly", label: "ذاكرلي عربي", language: "ar", query: "ذاكرلي عربي", kind: "channel" },
];

export interface VideoLesson {
  source: string;   // VideoSource id
  channel: string;  // label shown to the child
  title: string;    // video title, or the query when no key
  query: string;
  url: string;      // watch page or search page
  video_id: string | null; // set only when found through the API
}

export function sourcesFor(language: "en" | "ar", subject: string): VideoSource[] {
  const pool = VIDEO_SOURCES.filter((s) => s.language === language);
  const sci = /math|algebra|geometry|physics|chem|biolog|science/i.test(subject);
  const order = language === "ar" ? ["nafham", "madrasetna", "zakerly"] : sci ? ["khan", "oct", "dave", "crash", "animated"] : ["khan", "crash", "teded", "dave", "animated"];
  return order.map((id) => pool.find((s) => s.id === id)!).filter(Boolean).slice(0, 4);
}

export function searchUrl(q: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export function embedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1`;
}

interface YtItem { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }

/** One YouTube Data API search (100 quota units); null when there is no key or the call fails. */
async function searchYouTube(q: string): Promise<{ videoId: string; title: string; channel: string } | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.search = new URLSearchParams({ part: "snippet", type: "video", videoEmbeddable: "true", safeSearch: "strict", maxResults: "1", q, key }).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { items?: YtItem[] };
    const it = json.items?.[0];
    if (!it?.id?.videoId) return null;
    return { videoId: it.id.videoId, title: decodeEntities(it.snippet?.title ?? q), channel: it.snippet?.channelTitle ?? "" };
  } catch (err) {
    // A lesson without a video is still a lesson; a key that has expired or a quota that has run out would
    // otherwise quietly remove videos from every lesson with nobody the wiser.
    await report("videos.search", err, { meta: { query: q } });
    return null;
  }
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/** Builds the video list for a topic: one entry per source, real videos when the API key exists. */
export async function findVideos(topicQuery: string, language: "en" | "ar", subject: string): Promise<VideoLesson[]> {
  const sources = sourcesFor(language, subject);
  const out: VideoLesson[] = [];
  for (const s of sources) {
    const q = s.kind === "channel" ? `${s.query} ${topicQuery}` : `${topicQuery} ${s.query}`;
    const hit = await searchYouTube(q);
    if (hit) out.push({ source: s.id, channel: hit.channel || s.label, title: hit.title, query: q, url: `https://www.youtube.com/watch?v=${hit.videoId}`, video_id: hit.videoId });
    else out.push({ source: s.id, channel: s.label, title: `${s.label}: ${topicQuery}`, query: q, url: searchUrl(q), video_id: null });
  }
  return out;
}
