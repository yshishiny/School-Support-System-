import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadCoverage } from "@/lib/lms/load";
import { apply, bySubject, facets, totals, type Filter, type LessonState } from "@/lib/lms/coverage";
import { TopicRow } from "@/components/lms/TopicRow";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STATES: LessonState[] = ["missing", "held", "stale", "ready"];
const PAGE = 120;

function Bar({ s }: { s: { total?: number; topics?: number; ready: number; stale: number; held: number; missing: number } }) {
  const all = s.total ?? s.topics ?? 0;
  const pc = (n: number) => (all === 0 ? 0 : (n / all) * 100);
  return (
    <span className="flex h-2 w-full rounded-full overflow-hidden bg-panel-2" title={`${s.ready} written · ${s.stale} old · ${s.held} held · ${s.missing} not written`}>
      <span className="bg-good h-full" style={{ width: `${pc(s.ready)}%` }} />
      <span className="bg-warn h-full" style={{ width: `${pc(s.stale)}%` }} />
      <span className="bg-bad h-full" style={{ width: `${pc(s.held)}%` }} />
    </span>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return <Link href={href} className={`chip ${on ? "!border-accent text-accent-2" : ""}`}>{children}</Link>;
}

/**
 * The curriculum, and what has actually been made for it.
 *
 * Material is produced the night before a child needs it, which means "nothing here yet" and "here and correct"
 * have always looked the same from every other screen. This is the one page that can tell them apart, over the
 * whole catalogue at once — including the rows that do not exist, which is the only thing a per-topic query can
 * never show you.
 */
export default async function LmsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const q = await searchParams;
  const { rows, curricula } = await loadCoverage();

  const f: Filter = {
    curriculum: q.curriculum || undefined,
    grade: q.grade ? Number(q.grade) : undefined,
    subject: q.subject || undefined,
    language: q.language || undefined,
    state: STATES.includes(q.state as LessonState) ? (q.state as LessonState) : undefined,
  };
  const all = facets(rows);
  const shown = apply(rows, f);
  const sum = totals(shown);
  const whole = totals(rows);
  const confirmedVideos = rows.reduce((n, r) => n + r.videos, 0);
  const videoSearches = rows.reduce((n, r) => n + r.videoSearches, 0);
  const subjects = bySubject(shown);
  const page = Math.max(0, Number(q.page ?? 0) || 0);
  const slice = shown.slice(page * PAGE, page * PAGE + PAGE);

  const link = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { ...q, ...patch, page: patch.page ?? undefined };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return `/parent/lms${s ? `?${s}` : ""}`;
  };

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="h1">Lessons</h1>
        <Link href="/parent/lessons" className="btn-ghost btn-sm">🔍 To check</Link>
      </div>

      <section className="card space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {([
            ["Topics", whole.topics, ""],
            ["Written", whole.ready, "text-good"],
            ["Old", whole.stale, whole.stale ? "text-warn" : ""],
            ["Held", whole.held, whole.held ? "text-bad" : ""],
            ["Not written", whole.missing, whole.missing ? "text-bad" : ""],
          ] as const).map(([label, n, tone]) => (
            <div key={label}>
              <div className={`text-2xl font-bold leading-none ${tone}`} style={{ fontFamily: "var(--font-display)" }}>{n.toLocaleString()}</div>
              <div className="text-[11px] uppercase tracking-wide muted mt-1.5">{label}</div>
            </div>
          ))}
        </div>
        <Bar s={whole} />
        <p className="text-xs muted">
          {Math.round((whole.ready / Math.max(1, whole.topics)) * 100)}% of the catalogue has a basics lesson a child
          could open right now. Material is written the night before it is needed, so most of this is simply not
          reached yet rather than broken — but <b>held</b> means something was written and refused, and that needs a person.
        </p>
        <p className="text-xs muted">
          {whole.withVisuals} topic{whole.withVisuals === 1 ? " has" : "s have"} diagrams
          {confirmedVideos === 0
            ? `, and not one has a confirmed video: all ${videoSearches} links stored are searches for a video rather than a video`
            : `, ${whole.withVideos} ha${whole.withVideos === 1 ? "s" : "ve"} a real video`}
          {videoSearches > 0 && confirmedVideos > 0 && `, alongside ${videoSearches} unchecked search links`}.
        </p>
      </section>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <section className="card space-y-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs muted w-16">State</span>
          <Chip href={link({ state: undefined })} on={!f.state}>all</Chip>
          {STATES.map((s) => <Chip key={s} href={link({ state: s })} on={f.state === s}>{s === "ready" ? "written" : s === "missing" ? "not written" : s}</Chip>)}
        </div>
        {curricula.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs muted w-16">Curriculum</span>
            <Chip href={link({ curriculum: undefined })} on={!f.curriculum}>all</Chip>
            {all.curricula.map((c) => (
              <Chip key={c} href={link({ curriculum: c })} on={f.curriculum === c}>{curricula.find((x) => x.id === c)?.name ?? c}</Chip>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs muted w-16">Language</span>
          <Chip href={link({ language: undefined })} on={!f.language}>all</Chip>
          {all.languages.map((l) => <Chip key={l} href={link({ language: l })} on={f.language === l}>{l}</Chip>)}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs muted w-16">Grade</span>
          <Chip href={link({ grade: undefined })} on={f.grade === undefined}>all</Chip>
          {all.grades.map((g) => <Chip key={g} href={link({ grade: String(g) })} on={f.grade === g}>G{g}</Chip>)}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs muted w-16">Subject</span>
          <Chip href={link({ subject: undefined })} on={!f.subject}>all</Chip>
          {all.subjects.slice(0, 24).map((s) => <Chip key={s} href={link({ subject: s })} on={f.subject === s}>{s}</Chip>)}
        </div>
      </section>

      {/* ── By subject ────────────────────────────────────────────────────── */}
      <section className="card space-y-2">
        <h2 className="h2">By subject <span className="muted font-normal text-sm">· worst first</span></h2>
        <ul className="text-sm divide-y divide-line">
          {subjects.map((s) => (
            <li key={`${s.subject}|${s.language}`} className="py-2 flex items-center gap-3">
              <Link href={link({ subject: s.subject, language: s.language })} className="w-40 shrink-0 truncate hover:text-accent-2">
                {s.subject} <span className="muted text-xs">{s.language}</span>
              </Link>
              <span className="flex-1 min-w-0"><Bar s={s} /></span>
              <span className="shrink-0 text-xs muted tabular-nums w-28 text-right">
                {s.ready}/{s.total} written{s.held > 0 && <span className="text-bad"> · {s.held} held</span>}
              </span>
            </li>
          ))}
          {subjects.length === 0 && <li className="py-2 muted text-sm">Nothing matches those filters.</li>}
        </ul>
      </section>

      {/* ── The topics themselves ─────────────────────────────────────────── */}
      <section className="card space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="h2">Topics</h2>
          <span className="text-xs muted">
            {sum.topics.toLocaleString()} match{sum.topics === 1 ? "" : "es"}
            {sum.topics > PAGE && ` · showing ${page * PAGE + 1}–${Math.min(sum.topics, page * PAGE + PAGE)}`}
          </span>
        </div>
        <ul className="divide-y divide-line">
          {slice.map((r) => <TopicRow key={`${r.topic.id}-${r.topic.grade}`} r={r} />)}
          {slice.length === 0 && <li className="py-2 muted text-sm">Nothing matches those filters.</li>}
        </ul>
        {sum.topics > PAGE && (
          <div className="flex items-center gap-2">
            {page > 0 && <Link href={link({ page: String(page - 1) })} className="btn-ghost btn-sm">← Previous</Link>}
            {(page + 1) * PAGE < sum.topics && <Link href={link({ page: String(page + 1) })} className="btn-ghost btn-sm">Next →</Link>}
          </div>
        )}
      </section>
    </main>
  );
}
