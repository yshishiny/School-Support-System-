import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { prettyDate } from "@/lib/dates";
import { signMaterialUrls, type MaterialRow } from "@/lib/materials/server";
import { deleteMaterialAction, updateMaterialAction } from "@/lib/actions/materials";
import { MaterialUploader } from "@/components/MaterialUploader";
import { MaterialItemsReview, PrepareWorksheetButton, ReadAgainButton } from "@/components/MaterialCards";
import { Tabs } from "@/components/Tabs";
import { fileEmoji } from "@/lib/materials/files";
import { loadRevisions } from "@/lib/revision/run";
import { RevisionButton } from "@/components/RevisionButton";
import { materialStages } from "@/lib/materials/study";
import { todayIn } from "@/lib/dates";
import { SideTabs } from "@/components/SideTabs";
import { kidColor } from "@/lib/kid-tabs";

export const maxDuration = 300;

const KIND: Record<string, string> = { worksheet: "📝 Worksheet", notes: "📒 Notes", study_guide: "📘 Study guide", announcement: "📣 Announcement", other: "📎 File" };

/** School files from the class groups: upload with subject and instructions; the AI reads them once. */
export default async function MaterialsPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const [{ data: kids }, { data: subjectRows }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false }),
    supabase.from("subjects").select("name"),
    supabase.from("materials").select("*").eq("family_id", family.id).order("created_at", { ascending: false }).limit(60),
  ]);
  const students = kids ?? [];
  const materials = (rows ?? []) as MaterialRow[];
  const urls = await signMaterialUrls(materials.map((m) => ({ id: m.id, path: m.path })));
  const subjects = [...new Set((subjectRows ?? []).map((s) => s.name))].sort();
  const nameOf = (id: string) => students.find((s) => s.id === id)?.full_name.split(" ")[0] ?? "?";
  const { count: quizCounts } = await supabase.from("quizzes").select("id", { count: "exact", head: true }).not("material_id", "is", null);

  const today = todayIn(family.timezone);
  const revisions = await loadRevisions(students.map((s) => s.id), 40).catch(() => []);
  const { data: matQuizRows } = await supabase.from("quizzes").select("material_id, student_id, attempts(submitted_at, score, total)").in("student_id", students.map((s) => s.id)).not("material_id", "is", null);
  const matQuizzes = (matQuizRows ?? []) as { material_id: string; student_id: string; attempts: { submitted_at: string | null; score: number | null; total: number | null }[] }[];
  const needsAttention = materials.filter((m) => m.status === "failed" || (m.status === "ready" && !m.items_reviewed_at && (m.items?.length ?? 0) > 0));

  function FileCard({ m }: { m: MaterialRow }) {
    return (
      <section className="card space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-2xl">{fileEmoji(m.mime)}</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold">{m.title}</div>
            <div className="text-xs muted">{nameOf(m.student_id)} · {m.subject ?? "no subject"} · {m.kind ? KIND[m.kind] ?? m.kind : ""} · {prettyDate(m.created_at.slice(0, 10))} · {Math.round(m.size_bytes / 1024)} KB{m.status === "failed" ? " · ⚠️ not read" : m.status === "new" ? " · reading…" : ""}</div>
          </div>
          {urls.get(m.id) && <a href={urls.get(m.id)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Open</a>}
        </div>
        {m.status === "ready" && (() => {
          const done = matQuizzes.filter((q) => q.material_id === m.id).flatMap((q) => q.attempts.filter((a) => a.submitted_at));
          const st = materialStages(m.created_at.slice(0, 10), done.map((a) => a.submitted_at!.slice(0, 10)), today);
          const scores = done.filter((a) => a.total).map((a) => `${a.score}/${a.total}`);
          return <div className="flex flex-wrap gap-1.5 text-[11px]">{st.map((s) => <span key={s.n} className={`chip ${s.state === "done" ? "text-good" : s.state === "overdue" ? "text-bad" : s.state === "due" ? "text-warn" : "muted"}`}>{s.state === "done" ? "✓" : s.state === "overdue" ? "⏰" : "·"} {s.label}{s.state !== "done" ? ` by ${prettyDate(s.dueBy)}` : ""}</span>)}{scores.length > 0 && <span className="chip">scores {scores.join(", ")}</span>}</div>;
        })()}
        {m.summary && <p className="text-sm">{m.summary}</p>}
        {m.error && <p className="text-xs text-bad">{m.error}</p>}
        {m.status !== "new" && <ReadAgainButton materialId={m.id} />}
        {m.instructions && <p className="text-xs"><b>Instructions:</b> {m.instructions}</p>}
        {(m.topics?.length ?? 0) > 0 && <div className="flex flex-wrap gap-1">{m.topics!.map((t) => <span key={t} className="chip text-xs">{t}</span>)}</div>}
        {m.status === "ready" && !m.items_reviewed_at && (m.items?.length ?? 0) > 0 && <MaterialItemsReview materialId={m.id} items={m.items!} />}
        {m.status === "ready" && (m.kind === "worksheet" || m.worksheet) && <PrepareWorksheetButton materialId={m.id} prepared={m.worksheet ? { questions: m.worksheet.questions.length, skipped: m.worksheet.skipped, note: m.worksheet.note } : null} />}
        <details className="text-xs">
          <summary className="cursor-pointer muted">Edit or delete</summary>
          <form action={updateMaterialAction} className="mt-2 grid gap-2 sm:grid-cols-3">
            <input type="hidden" name="id" value={m.id} />
            <input name="title" className="input" defaultValue={m.title} />
            <input name="subject" className="input" defaultValue={m.subject ?? ""} placeholder="Subject" list="material-subjects" />
            <input name="instructions" className="input" defaultValue={m.instructions ?? ""} placeholder="Instructions" />
            <button className="btn-ghost btn-sm">Save</button>
          </form>
          <form action={deleteMaterialAction.bind(null, m.id)} className="mt-1"><button className="text-bad">Delete file</button></form>
        </details>
      </section>
    );
  }

  const byKid = students.map((s, idx) => {
    const list = materials.filter((m) => m.student_id === s.id);
    return {
      id: s.id,
      label: s.full_name.split(" ")[0],
      emoji: "📚",
      color: kidColor(idx),
      sub: `${list.length} file${list.length === 1 ? "" : "s"}`,
      content: list.length === 0 ? <p className="card muted text-sm">No files for {s.full_name.split(" ")[0]} yet.</p> : <div className="space-y-3">{list.map((m) => <FileCard key={m.id} m={m} />)}</div>,
    };
  });

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">📎 School files</h1>
        <Link href="/parent/import" className="btn-ghost btn-sm">← Import</Link>
      </div>
      <p className="text-sm muted">The files the teachers drop in the WhatsApp groups: PDF, photo, Word, PowerPoint, Excel, CSV or text. Save the file from WhatsApp, upload it here with the subject and what the teacher asked. The AI reads it, suggests the tasks (you approve), and the boys can practise straight from the file on their Learn page. {quizCounts ? `${quizCounts} practice set${quizCounts === 1 ? "" : "s"} made from files so far.` : ""}</p>
      <Tabs
        storageKey="materials"
        defaultId={needsAttention.length > 0 ? "review" : "upload"}
        tabs={[
          { id: "upload", label: "Upload", emoji: "⬆️", content: students.length === 0 ? <p className="card">Add a child first.</p> : <MaterialUploader familyId={family.id} students={students} subjects={subjects} /> },
          { id: "review", label: "To review", emoji: "✅", badge: needsAttention.length, content: needsAttention.length === 0 ? <p className="card muted text-sm">Nothing waiting: every file has been read and its tasks approved.</p> : <div className="space-y-3">{needsAttention.map((m) => <FileCard key={m.id} m={m} />)}</div> },
          { id: "revision", label: "Revision", emoji: "📚", badge: revisions.filter((r) => r.status === "ready").length || null, content: (
            <div className="space-y-3">
              <section className="card space-y-2">
                <h2 className="h2">What happens to every file</h2>
                <ol className="text-sm list-decimal pl-5 space-y-1">
                  <li><b>Read once by the AI</b>: summary, topics, a study digest, and any tasks (you approve those).</li>
                  <li><b>Three practice sets, spaced</b>: a first set within 3 days, a second by day 7, a third by day 14, each made only from the file. They appear on his Today and count as the “School files practised on time” basic in the allowance.</li>
                  <li><b>Worksheets</b> become an on-system version of the teacher's own questions.</li>
                  <li><b>Class log cross-check</b>: a file for a subject he marked “no class” raises a question to him and to you.</li>
                  <li><b>Monthly revision</b> from the 25th: one sheet (must-know list, worked examples, traps, self-test) and one 12-question quiz per subject, built from all of that month's files.</li>
                </ol>
              </section>
              <section className="card space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="h2">Revision sheets</h2><RevisionButton studentId={null} /></div>
                {revisions.length === 0 ? <p className="text-sm muted">None yet. They are built automatically from the 25th of each month, or now with the button.</p> : (
                  <ul className="divide-y divide-line text-sm">
                    {revisions.map((r) => (
                      <li key={r.id} className="py-2 flex flex-wrap items-center gap-2">
                        <span>{r.status === "ready" ? "🟢" : r.status === "failed" ? "🔴" : "🟡"}</span>
                        <b>{nameOf(r.student_id)}</b>
                        <span className="flex-1">{r.subject} · {r.month.slice(0, 7)} · {r.material_ids.length} file{r.material_ids.length === 1 ? "" : "s"}</span>
                        {r.error && <span className="text-xs text-bad">{r.error.slice(0, 80)}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) },
          { id: "files", label: "All files", emoji: "🗂️", badge: materials.length, content: students.length === 0 ? <p className="card muted text-sm">Add a child first.</p> : materials.length === 0 ? <p className="card muted text-sm">No files yet.</p> : <SideTabs storageKey="materials-kids" tabs={byKid} /> },
        ]}
      />
    </main>
  );
}
