import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { prettyDate } from "@/lib/dates";
import { signMaterialUrls, type MaterialRow } from "@/lib/materials/server";
import { deleteMaterialAction, updateMaterialAction } from "@/lib/actions/materials";
import { MaterialUploader } from "@/components/MaterialUploader";
import { MaterialItemsReview, PrepareWorksheetButton, ReadAgainButton } from "@/components/MaterialCards";

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

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">📎 School files</h1>
        <Link href="/parent/import" className="btn-ghost btn-sm">← Import</Link>
      </div>
      <p className="text-sm muted">The PDFs and photos the teachers drop in the WhatsApp groups. Save the file from WhatsApp, upload it here with the subject and what the teacher asked. The AI reads it, suggests the tasks (you approve), and the boys can practise straight from the file on their Learn page. {quizCounts ? `${quizCounts} practice set${quizCounts === 1 ? "" : "s"} made from files so far.` : ""}</p>
      {students.length === 0 ? <p className="card">Add a child first.</p> : <MaterialUploader familyId={family.id} students={students} subjects={subjects} />}

      {materials.map((m) => (
        <section key={m.id} className="card space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-2xl">{m.mime === "application/pdf" ? "📄" : "🖼️"}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold">{m.title}</div>
              <div className="text-xs muted">{nameOf(m.student_id)} · {m.subject ?? "no subject"} · {m.kind ? KIND[m.kind] ?? m.kind : ""} · {prettyDate(m.created_at.slice(0, 10))} · {Math.round(m.size_bytes / 1024)} KB{m.status === "failed" ? " · ⚠️ not read" : m.status === "new" ? " · reading…" : ""}</div>
            </div>
            {urls.get(m.id) && <a href={urls.get(m.id)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Open</a>}
          </div>
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
      ))}
      {materials.length === 0 && <p className="card muted text-sm">No files yet.</p>}
    </main>
  );
}
