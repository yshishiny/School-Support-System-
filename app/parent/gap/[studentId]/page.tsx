import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { gapFor } from "@/lib/lms/gap-load";
import { headline } from "@/lib/lms/gap";
import { Tabs, type TabDef } from "@/components/Tabs";
import { Group, MoreList } from "@/components/MoreList";
import type { Match } from "@/lib/lms/gap";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function Row({ m, show }: { m: Match; show: "matched" | "closest" }) {
  return (
    <li className="py-2">
      <div className="text-sm">{m.taught}</div>
      <div className="text-xs muted">
        from “{m.fromTitle}”
        {show === "matched" && m.best && <> · matches <b className="text-ink">{m.best.name}</b></>}
        {show === "closest" && (m.best && m.score > 0
          ? <> · closest wording in the curriculum is “{m.best.name}” ({Math.round(m.score * 100)}%), which is not the same topic</>
          : <> · nothing in the curriculum resembles it</>)}
      </div>
    </li>
  );
}

/**
 * The school's term against the child's curriculum.
 *
 * Files arrive from the class group with the topics the model pulled out of them; the curriculum holds its own
 * names for things; nothing joined the two. So "we uploaded the term's worksheets" and "the app has lessons for
 * them" were two claims that could never be checked against each other, and the second one was quietly false.
 */
export default async function GapPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { family } = await requireParent();
  const { studentId } = await params;
  const { data: kid } = await createAdminClient()
    .from("profiles").select("id, full_name").eq("id", studentId).eq("family_id", family.id).maybeSingle();
  if (!kid) notFound();
  const child = kid as { id: string; full_name: string };
  const first = child.full_name.split(" ")[0];

  const report = await gapFor(studentId, family.id);
  if (!report) notFound();
  const { gap: g, curriculumName, grade, files, otherSets } = report;
  const taught = g.covered.length + g.needsLesson.length + g.offCurriculum.length;
  const pc = (n: number) => (taught === 0 ? 0 : Math.round((n / taught) * 100));

  const bySubjectNotTaught = [...new Map(g.notTaughtYet.map((t) => [t.subject, [] as typeof g.notTaughtYet])).entries()]
    .map(([subject]) => [subject, g.notTaughtYet.filter((t) => t.subject === subject)] as const);

  const tabs: TabDef[] = [
    {
      id: "needs", label: "Needs a lesson", emoji: "✍️", badge: g.needsLesson.length || null,
      content: g.needsLesson.length === 0
        ? <p className="card text-sm muted">Nothing the school is teaching is waiting on a lesson.</p>
        : (
          <ul className="card divide-y divide-line">
            <MoreList show={8} noun="more topic" className="">{g.needsLesson.map((m, i) => <Row key={i} m={m} show="matched" />)}</MoreList>
          </ul>
        ),
    },
    {
      id: "off", label: "Not in the curriculum", emoji: "❓", badge: g.offCurriculum.length || null,
      content: (
        <div className="space-y-2">
          <p className="card text-sm">
            The school taught these, and nothing in {first}&apos;s {curriculumName ?? "curriculum"} for grade {grade} matches them.
            That is usually one of two things: <b>revision of earlier years</b>, or <b>the school following a different syllabus</b> from
            the one set on {first}&apos;s profile. The second is worth fixing on the profile — every other number on this page depends on it.
          </p>
          <ul className="card divide-y divide-line">
            <MoreList show={10} noun="more topic" className="">{g.offCurriculum.map((m, i) => <Row key={i} m={m} show="closest" />)}</MoreList>
          </ul>
        </div>
      ),
    },
    {
      id: "ready", label: "Ready", emoji: "✅", badge: g.covered.length || null,
      content: g.covered.length === 0
        ? <p className="card text-sm muted">No topic the school has sent has a lesson written for it yet.</p>
        : <ul className="card divide-y divide-line">{g.covered.map((m, i) => <Row key={i} m={m} show="matched" />)}</ul>,
    },
    {
      id: "ahead", label: "Not reached yet", emoji: "🗓️", badge: g.notTaughtYet.length || null,
      content: (
        <div className="space-y-2">
          <p className="card text-xs muted">
            In the curriculum, and no file the school has sent mentions them. Not late — just not reached.
          </p>
          <div className="card">
            {bySubjectNotTaught.map(([subject, list]) => (
              <Group key={subject} title={subject} count={list.length}>
                <ul className="divide-y divide-line text-sm">
                  {list.map((t) => (
                    <li key={t.id} className="py-1.5 flex items-center gap-2">
                      <span className="flex-1">{t.name}<span className="muted text-xs"> · {t.unit}</span></span>
                      {t.hasLesson && <span className="badge text-good text-xs">written</span>}
                    </li>
                  ))}
                </ul>
              </Group>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <main className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="h1 truncate">{first} · school vs prepared</h1>
          <p className="text-xs muted">
            Grade {grade ?? "—"} · {curriculumName ?? "no curriculum set"} · {files} file{files === 1 ? "" : "s"} from school
          </p>
        </div>
        <Link href={`/parent/trace/${child.id}`} className="btn-ghost btn-sm shrink-0">← {first}</Link>
      </div>

      <section className="card space-y-2">
        <p className="text-sm">{headline(g, first)}</p>
        <div className="grid grid-cols-3 gap-3">
          {([
            ["Ready", g.covered.length, "text-good"],
            ["Needs a lesson", g.needsLesson.length, g.needsLesson.length ? "text-warn" : ""],
            ["Not in curriculum", g.offCurriculum.length, g.offCurriculum.length ? "text-bad" : ""],
          ] as const).map(([label, n, tone]) => (
            <div key={label}>
              <div className={`text-2xl font-bold leading-none ${tone}`} style={{ fontFamily: "var(--font-display)" }}>{n}</div>
              <div className="text-[11px] uppercase tracking-wide muted mt-1.5">{label}</div>
            </div>
          ))}
        </div>
        <span className="flex h-2 w-full rounded-full overflow-hidden bg-panel-2">
          <span className="bg-good h-full" style={{ width: `${pc(g.covered.length)}%` }} />
          <span className="bg-warn h-full" style={{ width: `${pc(g.needsLesson.length)}%` }} />
          <span className="bg-bad h-full" style={{ width: `${pc(g.offCurriculum.length)}%` }} />
        </span>
        <p className="text-xs muted">
          Topics are paired on the words they share, not by a model, so a pairing can always be read and argued
          with. A pairing it is not sure of is never counted as covered — a wrong pairing would mark a gap as
          filled, which is the one mistake this page exists to avoid.
        </p>
      </section>

      {otherSets.length > 0 && (
        <section className="card space-y-1 border-warn/50">
          <h2 className="h2 text-base">⚠️ Other topic sets exist at this grade</h2>
          <p className="text-sm">
            {first} is measured against <b>{curriculumName ?? "no curriculum"}</b>. Grade {grade} also holds:
          </p>
          <ul className="text-sm divide-y divide-line">
            {otherSets.map((s) => (
              <li key={s.name} className="py-1.5 flex items-center gap-2">
                <span className="flex-1">{s.name}</span>
                <span className="text-xs muted">{s.topics} topics</span>
                <span className={`badge text-xs ${s.lessons > 0 ? "text-warn" : ""}`}>{s.lessons} lesson{s.lessons === 1 ? "" : "s"} written</span>
              </li>
            ))}
          </ul>
          <p className="text-xs muted">
            A lesson written against a set {first} is not on does not reach {first}. If most of the written work sits
            in another row here, that is where it has gone.
          </p>
        </section>
      )}

      <Tabs tabs={tabs} storageKey={`gap:${child.id}`} />
    </main>
  );
}
