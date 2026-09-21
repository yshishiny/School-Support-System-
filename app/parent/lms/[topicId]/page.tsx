import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Tabs, type TabDef } from "@/components/Tabs";
import { LessonActions } from "@/components/lms/LessonActions";
import { materialFor, mediaLine, readVideos, readVisuals, type HeldDetail, type LessonDetail, type Material } from "@/lib/lms/material";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

function Meta({ m }: { m: Material }) {
  const bits = [
    when(m.writtenAt) && `written ${when(m.writtenAt)}`,
    m.model && `by ${m.model}`,
    m.words > 0 && `${m.words.toLocaleString()} words`,
    m.reviewedAt ? `signed off ${when(m.reviewedAt)}` : m.checkedAt ? "passed its checks" : null,
  ].filter(Boolean) as string[];
  return <p className="text-xs muted">{bits.join(" · ")}</p>;
}

/** One level of one topic: the state, then the text itself, because the text is the thing being judged. */
function Level({ m, topicId }: { m: Material; topicId: string }) {
  return (
    <div className="space-y-3">
      {m.heldOn && (
        <p className="card text-sm border-bad/60">
          <b className="text-bad">Held.</b> A lesson was written and the reviewer refused it{m.heldOn.length > 0 ? `: ${m.heldOn.join(", ")}` : ""}.
          No child has seen it. Rewriting gives the model another go.
        </p>
      )}
      {m.warnings.length > 0 && (
        <p className="card text-sm border-warn/60">
          <b className="text-warn">Stored with warnings:</b> {m.warnings.join(", ")}. Children can read this one — read it yourself before deciding.
        </p>
      )}
      {m.reviewedNote && <p className="card text-sm">Note left for the model: “{m.reviewedNote}”</p>}

      <Meta m={m} />
      <LessonActions topicId={topicId} level={m.level} exists={m.script !== null} />

      {m.script === null ? (
        <p className="card text-sm muted">
          Nothing written at this depth. Material is made the night before a child needs it, so this is normal for a
          topic nobody has reached — the button above makes it now.
        </p>
      ) : (
        <article className="card prose-lesson text-sm leading-relaxed space-y-2">
          <ReactMarkdown>{m.script}</ReactMarkdown>
        </article>
      )}
    </div>
  );
}

/**
 * Everything stored for one topic, laid out to be read rather than counted.
 *
 * The list page can tell you a lesson exists. Only this one can tell you whether it is any good, which is why the
 * script is shown in full and the diagrams are rendered rather than tallied.
 */
export default async function LmsTopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  await requireAdmin();
  const { topicId } = await params;
  const admin = createAdminClient();

  const [{ data: topic }, { data: lessons }, { data: resources }, { data: held }] = await Promise.all([
    admin.from("topics").select("id, name, subject, unit, language, grade, stream, track, curriculum_id").eq("id", topicId).maybeSingle(),
    admin.from("lessons").select("level, content_md, model, created_at, checked_at, failed_checks, human_reviewed_at, human_note").eq("topic_id", topicId),
    admin.from("topic_resources").select("visuals, videos, model, updated_at").eq("topic_id", topicId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("held_lessons").select("level, blocking, cleared_at, created_at").eq("topic_id", topicId),
  ]);
  if (!topic) notFound();

  const t = topic as { id: string; name: string; subject: string; unit: string | null; language: string | null; grade: number | null; stream: string | null; track: string; curriculum_id: string | null };
  const ls = (lessons ?? []) as LessonDetail[];
  const hs = (held ?? []) as HeldDetail[];
  const res = resources as { visuals: unknown; videos: unknown; model: string | null; updated_at: string } | null;
  const visuals = readVisuals(res?.visuals);
  const videos = readVideos(res?.videos);

  const basics = materialFor("basics", ls, hs);
  const advanced = materialFor("advanced", ls, hs);

  const tabs: TabDef[] = [
    { id: "basics", label: "Basics", emoji: "📖", badge: basics.script ? `${basics.words}w` : basics.heldOn ? "held" : "—", content: <Level m={basics} topicId={t.id} /> },
    { id: "deep", label: "Deep", emoji: "🔬", badge: advanced.script ? `${advanced.words}w` : advanced.heldOn ? "held" : "—", content: <Level m={advanced} topicId={t.id} /> },
    {
      id: "media",
      label: "Diagrams & videos",
      emoji: "🎬",
      badge: visuals.length + videos.length || null,
      content: (
        <div className="space-y-3">
          <p className="text-xs muted">{mediaLine(visuals, videos)}{res?.model ? ` · made by ${res.model}` : ""}</p>
          <LessonActions topicId={t.id} level="basics" exists={basics.script !== null} mediaOnly mediaExists={visuals.length > 0 || videos.length > 0} />

          {visuals.map((v, i) => (
            <figure key={i} className="card space-y-2">
              <figcaption className="text-sm font-medium">{v.title}</figcaption>
              {/* Stored SVG, written by the same pipeline that writes the lessons — this page exists so a person can look at it. */}
              <div className="rounded-xl overflow-hidden bg-white" dangerouslySetInnerHTML={{ __html: v.svg }} />
              {v.caption && <figcaption className="text-xs muted">{v.caption}</figcaption>}
            </figure>
          ))}
          {visuals.length === 0 && <p className="card text-sm muted">No diagrams stored for this topic.</p>}

          <ul className="card text-sm divide-y divide-line">
            {videos.map((v, i) => (
              <li key={i} className="py-2 flex items-start gap-2">
                <span className="shrink-0">{v.kind === "video" ? "▶️" : "🔎"}</span>
                <span className="min-w-0 flex-1">
                  <a href={v.url} target="_blank" rel="noreferrer" className="hover:text-accent-2 break-words">{v.title}</a>
                  <span className="block text-xs muted">
                    {v.channel ?? v.source ?? "unknown channel"}
                    {v.kind === "search" && " · a search, not a video — nobody has confirmed one is on the other end"}
                  </span>
                </span>
              </li>
            ))}
            {videos.length === 0 && <li className="py-2 muted">No videos stored for this topic.</li>}
          </ul>
        </div>
      ),
    },
  ];

  return (
    <main className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="h1 truncate">{t.name}</h1>
          <p className="text-xs muted">
            {t.subject}{t.unit ? ` · ${t.unit}` : ""} · {t.language ?? "en"}
            {t.grade !== null && ` · G${t.grade}`}
            {t.stream && ` · ${t.stream}`}
            {t.track && t.track !== "school" && ` · ${t.track}`}
          </p>
        </div>
        <Link href="/parent/lms" className="btn-ghost btn-sm shrink-0">← Lessons</Link>
      </div>
      <Tabs tabs={tabs} storageKey={`lms:${t.id}`} />
    </main>
  );
}
