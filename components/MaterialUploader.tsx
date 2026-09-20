"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { registerMaterialAction } from "@/lib/actions/materials";
import type { RegisterMaterialResult } from "@/lib/materials/read";
import { ACCEPT, ACCEPT_LABEL, extFor, resolveMime } from "@/lib/materials/files";

const MAX = 25 * 1024 * 1024;

/**
 * Upload a PDF, photo, Word, PowerPoint, Excel, CSV or text file from the class group with the subject and the teacher's instructions.
 * Goes straight to the private bucket, then the AI reads it (30-60 s for a long PDF).
 */
export function MaterialUploader({ familyId, students, subjects, fixedStudentId }: { familyId: string; students: { id: string; full_name: string }[]; subjects: string[]; fixedStudentId?: string }) {
  const router = useRouter();
  const [studentId, setStudentId] = useState(fixedStudentId ?? students[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [instructions, setInstructions] = useState("");
  const [weekSummary, setWeekSummary] = useState<"" | "this" | "last">("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RegisterMaterialResult[]>([]);

  async function go() {
    if (!studentId || files.length === 0) return;
    setError(null);
    setResults([]);
    const supabase = createBrowserSupabase();
    const out: RegisterMaterialResult[] = [];
    try {
      for (const [i, f] of files.entries()) {
        const mime = resolveMime(f.name, f.type);
        if (!mime) throw new Error(`${f.name}: only ${ACCEPT_LABEL}.`);
        if (f.size > MAX) throw new Error(`${f.name} is over 25 MB.`);
        setBusy(`Uploading ${i + 1} of ${files.length}…`);
        const path = `${familyId}/${studentId}/${crypto.randomUUID()}.${extFor(mime)}`;
        const { error: upErr } = await supabase.storage.from("materials").upload(path, f, { contentType: mime, upsert: false });
        if (upErr) throw new Error(upErr.message);
        setBusy(`Reading ${f.name}… (up to a minute for a long PDF)`);
        const r = await registerMaterialAction(studentId, path, { mime, size: f.size, name: f.name, subject, instructions, weekSummary: weekSummary || null });
        if (r.error) throw new Error(r.error);
        out.push(r);
        setResults([...out]);
      }
      setFiles([]);
      setInstructions("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card space-y-3">
      <h2 className="h2">📎 Add a file from the group</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {!fixedStudentId && (
          <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        )}
        <input className="input" list="material-subjects" placeholder="Subject (Math, Arabic, Biology…)" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <datalist id="material-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      <textarea className="input" rows={2} placeholder="Instructions from the teacher, e.g. “Solve pages 3–5 for Thursday” or “Study this for the quiz on Monday”" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={600} />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-semibold">Weekly syllabus / week summary?</span>
        {([["", "No, a normal file"], ["this", "Yes, this week"], ["last", "Yes, last week"]] as const).map(([v, label]) => (
          <label key={v} className="flex items-center gap-1"><input type="radio" name="week_summary" checked={weekSummary === v} onChange={() => setWeekSummary(v)} />{label}</label>
        ))}
        <span className="muted">The dates printed in the file are checked against your choice; a typo at school is flagged, not trusted.</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn-ghost cursor-pointer">
          {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} chosen` : "Choose files (PDF, photo, Word, Excel…)"}
          <input type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} />
        </label>
        <button type="button" className="btn-primary" disabled={!!busy || files.length === 0} onClick={go}>{busy ?? "Upload and read"}</button>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      {results.map((r, i) => (
        <div key={i} className="tile !p-2 text-sm"><b>{r.title}</b><div className="text-xs muted">{r.summary}</div>{r.items ? <div className="text-xs text-good">{r.items} suggested task{r.items === 1 ? "" : "s"} below, waiting for your OK.</div> : null}</div>
      ))}
    </div>
  );
}
