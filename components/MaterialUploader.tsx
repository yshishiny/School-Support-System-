"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { knownMaterialsAction, registerMaterialAction } from "@/lib/actions/materials";
import { classify, overCap, skipLine, toUpload, type Candidate } from "@/lib/materials/duplicates";
import type { RegisterMaterialResult } from "@/lib/materials/read";
import { ACCEPT, ACCEPT_LABEL, extFor, resolveMime } from "@/lib/materials/files";

const MAX = 25 * 1024 * 1024;
/** Was five, and anything past the fifth was dropped without a word. Whatever the number, it is now stated. */
const CAP = 20;

/** The file's own bytes, which is the only thing that survives being renamed and re-titled. */
async function sha256(f: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
  const [skipped, setSkipped] = useState<string[]>([]);
  const [dropped, setDropped] = useState<string[]>([]);

  async function go() {
    if (!studentId || files.length === 0) return;
    setError(null);
    setResults([]);
    setSkipped([]);
    const supabase = createBrowserSupabase();
    const nameOfStudent = (id: string) => students.find((s) => s.id === id)?.full_name.split(" ")[0] ?? "another child";

    try {
      for (const f of files) {
        if (!resolveMime(f.name, f.type)) throw new Error(`${f.name}: only ${ACCEPT_LABEL}.`);
        if (f.size > MAX) throw new Error(`${f.name} is over 25 MB.`);
      }

      // Hash first, ask second, upload third: a file the family has already had read costs nothing at all.
      setBusy("Checking for files already sent…");
      const candidates: Candidate[] = await Promise.all(
        files.map(async (f) => ({ name: f.name, sha: await sha256(f), size: f.size })),
      );
      // Position, not name: two different files can arrive with the same name, and a Map keyed by name would
      // upload one of them twice and the other never.
      const atIndex = new Map(candidates.map((c, i) => [i, files[i]]));
      const known = await knownMaterialsAction(candidates.map((c) => c.sha));
      const verdicts = classify(candidates, known, studentId);
      setSkipped(verdicts.map((v) => skipLine(v, nameOfStudent)).filter((l): l is string => l !== null));

      const wanted = verdicts.map((v, i) => ({ v, i })).filter(({ v }) => toUpload([v]).length > 0);
      if (wanted.length === 0) {
        setFiles([]);
        router.refresh();
        return;
      }

      // Every upload runs at once. Previously each file waited for the last one's AI read to finish before it
      // even started transferring, which put the whole transfer on the critical path for no reason.
      setBusy(`Uploading ${wanted.length} file${wanted.length === 1 ? "" : "s"}…`);
      const uploaded = await Promise.all(
        wanted.map(async ({ v, i }) => {
          const f = atIndex.get(i)!;
          const mime = resolveMime(f.name, f.type)!;
          const path = `${familyId}/${studentId}/${crypto.randomUUID()}.${extFor(mime)}`;
          const { error: upErr } = await supabase.storage.from("materials").upload(path, f, { contentType: mime, upsert: false });
          if (upErr) throw new Error(`${f.name}: ${upErr.message}`);
          return { f, mime, path, sha: v.sha };
        }),
      );

      // The reads stay one at a time: they are the AI call, and running them in a crowd is how a family hits a
      // rate limit mid-batch and loses the tail of it.
      const out: RegisterMaterialResult[] = [];
      for (const [i, u] of uploaded.entries()) {
        setBusy(`Reading ${u.f.name} — ${i + 1} of ${uploaded.length} (up to a minute for a long PDF)`);
        const r = await registerMaterialAction(studentId, u.path, {
          mime: u.mime, size: u.f.size, name: u.f.name, subject, instructions, weekSummary: weekSummary || null, sha: u.sha,
        });
        if (r.error) throw new Error(`${u.f.name}: ${r.error}`);
        out.push(r);
        setResults([...out]);
      }
      setFiles([]);
      setDropped([]);
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
          <input
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              onChange={(e) => {
                const chosen = Array.from(e.target.files ?? []);
                setFiles(chosen.slice(0, CAP));
                setDropped(overCap(chosen.map((f) => f.name), CAP).dropped);
                setSkipped([]);
              }}
            />
        </label>
        <button type="button" className="btn-primary" disabled={!!busy || files.length === 0} onClick={go}>{busy ?? "Upload and read"}</button>
      </div>
      {dropped.length > 0 && (
        <p className="text-sm text-warn">
          Only {CAP} files at a time, so {dropped.length} {dropped.length === 1 ? "was" : "were"} not taken: {dropped.join(", ")}. Send {dropped.length === 1 ? "it" : "them"} in the next batch.
        </p>
      )}
      {skipped.length > 0 && (
        <ul className="text-xs muted space-y-0.5">
          {skipped.map((l, i) => <li key={i}>↩︎ {l}</li>)}
        </ul>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}
      {results.map((r, i) => (
        <div key={i} className="tile !p-2 text-sm"><b>{r.title}</b><div className="text-xs muted">{r.summary}</div>{r.items ? <div className="text-xs text-good">{r.items} suggested task{r.items === 1 ? "" : "s"} below, waiting for your OK.</div> : null}</div>
      ))}
    </div>
  );
}
