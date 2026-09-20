"use client";

import { useState } from "react";
import { setChildCurriculumAction } from "@/lib/actions/curriculum";
import type { Curriculum, Level } from "@/lib/curriculum";

/**
 * Which curriculum this child follows.
 *
 * Grade alone was never enough. From the second Egyptian secondary year two children in the same year study
 * different subjects, so the year and the stream are chosen together and the stream selector appears only for the
 * years that have one — a stream box on Prep 2 is an invitation to answer a question that does not exist.
 */
export function CurriculumPicker({
  studentId, curricula, levelsByCurriculum, current,
}: {
  studentId: string;
  curricula: Curriculum[];
  levelsByCurriculum: Record<string, Level[]>;
  current: { curriculumId: string | null; grade: number | null; stream: string | null };
}) {
  const [cid, setCid] = useState(current.curriculumId ?? "");
  const [grade, setGrade] = useState(current.grade?.toString() ?? "");
  const [stream, setStream] = useState(current.stream ?? "");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, setBusy] = useState(false);

  const levels = levelsByCurriculum[cid] ?? [];
  const grades = [...new Set(levels.map((l) => l.grade))].sort((a, b) => a - b);
  const streams = levels.filter((l) => l.grade === Number(grade) && l.stream);

  async function save(formData: FormData) {
    setBusy(true);
    setMsg(await setChildCurriculumAction(formData));
    setBusy(false);
  }

  return (
    <form action={save} className="card space-y-2.5">
      <input type="hidden" name="student_id" value={studentId} />
      <div className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>Curriculum</div>
      <p className="text-xs muted">
        Choosing one gives him the right subjects and the whole year&apos;s topics, instead of subject names typed in by hand.
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="label">System</span>
          <select
            className="input" name="curriculum_id" value={cid}
            onChange={(e) => { setCid(e.target.value); setGrade(""); setStream(""); }}
          >
            <option value="">Not set</option>
            {curricula.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="label">Year</span>
          <select
            className="input" name="grade" value={grade} disabled={!cid}
            onChange={(e) => { setGrade(e.target.value); setStream(""); }}
          >
            <option value="">Choose…</option>
            {grades.map((g) => {
              const common = levels.find((l) => l.grade === g && !l.stream);
              return <option key={g} value={g}>{common?.label ?? `Grade ${g}`}</option>;
            })}
          </select>
        </label>

        {/* Only the streamed years ask. */}
        {streams.length > 0 && (
          <label className="block">
            <span className="label">Stream</span>
            <select className="input" name="stream" value={stream} onChange={(e) => setStream(e.target.value)}>
              <option value="">Choose…</option>
              {streams.map((l) => <option key={l.stream!} value={l.stream!}>{l.label_ar ?? l.label}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary btn-sm" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        {msg.ok && <span className="text-xs text-good">{msg.ok}</span>}
        {msg.error && <span className="text-xs text-bad">{msg.error}</span>}
      </div>
    </form>
  );
}
