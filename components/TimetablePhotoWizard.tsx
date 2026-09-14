"use client";

import { useActionState, useState, useTransition } from "react";
import { analyzeTimetablePhotoAction, confirmTimetableAction } from "@/lib/actions/import";
import { Notice, SubmitButton } from "./ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function TimetablePhotoWizard({ students }: { students: { id: string; full_name: string }[] }) {
  const [state, analyze] = useActionState(analyzeTimetablePhotoAction, undefined);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();

  if (done !== null) {
    return (
      <div className="card space-y-2">
        <p className="h2">Timetable saved ✓</p>
        <p className="text-sm muted">{done} lessons loaded. The Today page now shows the day's classes.</p>
        <a href="/parent/children" className="btn-ghost">View timetable</a>
      </div>
    );
  }

  if (state?.entries && state.studentId) {
    const name = students.find((s) => s.id === state.studentId)?.full_name;
    return (
      <div className="card space-y-3">
        <p className="text-sm">Read {state.entries.length} lessons{state.grade ? ` (grade ${state.grade})` : ""} for <b>{name}</b>. This replaces the current timetable.</p>
        <ul className="text-sm divide-y divide-line max-h-80 overflow-y-auto">
          {state.entries.map((e, i) => (
            <li key={i} className="py-1 flex gap-2">
              <span className="muted w-10">{DAYS[e.weekday]}</span>
              <span className="muted w-24">{e.start_time}–{e.end_time}</span>
              <span className="flex-1">{e.subject_name}{e.teacher ? <span className="muted"> · {e.teacher}</span> : null}</span>
            </li>
          ))}
        </ul>
        <button className="btn-primary w-full" disabled={pending} onClick={() => start(async () => setDone((await confirmTimetableAction(state.studentId!, state.entries!)).added))}>
          {pending ? "Saving…" : "Save timetable"}
        </button>
      </div>
    );
  }

  return (
    <form action={analyze} className="card space-y-3">
      <h2 className="h2">Timetable from a photo</h2>
      <div>
        <label className="label">Child</label>
        <select name="student_id" className="input" defaultValue={students[0]?.id}>
          {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Timetable photo</label>
        <input name="images" type="file" accept="image/*" className="input" required />
      </div>
      <SubmitButton className="btn-ghost w-full" pendingText="Reading the timetable… (15–30s)">Read timetable</SubmitButton>
      <Notice error={state?.error} />
    </form>
  );
}
