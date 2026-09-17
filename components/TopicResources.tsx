import type { Visual } from "@/lib/learning/resources";
import { embedUrl, type VideoLesson } from "@/lib/videos";

/** The diagrams and the video lessons under a topic's lesson. SVGs were sanitized when they were stored. */
export function TopicVisuals({ visuals }: { visuals: Visual[] }) {
  if (visuals.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="h2">🖼️ See it</h2>
      {visuals.map((v, i) => (
        <figure key={i} className="tile space-y-1">
          <div className="font-bold text-sm">{v.title}</div>
          <div className="rounded-xl overflow-hidden bg-white [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: v.svg }} />
          <figcaption className="text-xs muted">{v.caption}</figcaption>
        </figure>
      ))}
    </section>
  );
}

export function TopicVideos({ videos }: { videos: VideoLesson[] }) {
  if (videos.length === 0) return null;
  const embedded = videos.filter((v) => v.video_id);
  const links = videos.filter((v) => !v.video_id);
  return (
    <section className="space-y-3">
      <h2 className="h2">▶️ Watch it explained {videos.length > 1 ? "by different teachers" : ""}</h2>
      {embedded.map((v) => (
        <div key={v.source} className="tile space-y-1">
          <div className="text-xs muted">{v.channel}</div>
          <div className="aspect-video rounded-xl overflow-hidden bg-black">
            <iframe src={embedUrl(v.video_id!)} title={v.title} className="w-full h-full" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
          </div>
          <div className="text-sm font-semibold">{v.title}</div>
        </div>
      ))}
      {links.length > 0 && (
        <ul className="tile divide-y divide-line">
          {links.map((v) => (
            <li key={v.source} className="py-2 flex items-center gap-2 text-sm">
              <span className="text-lg">▶️</span>
              <a href={v.url} target="_blank" rel="noreferrer" className="flex-1 hover:text-accent-2"><b>{v.channel}</b> <span className="muted">· open on YouTube</span></a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
