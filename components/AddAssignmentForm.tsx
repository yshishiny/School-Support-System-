"use client";

import { useActionState, useState } from "react";
import { createAssignmentAction } from "@/lib/actions/assignments";
import { KIND_LABEL, type AssignmentKind, type Subject } from "@/lib/types";
import { Notice, SubmitButton } from "./ui";

export function AddAssignmentForm({
  students,
  subjects,
  defaultDate,
  compact = false,
}: {
  students?: { id: string; full_name: string }[];
  subjects: Subject[];
  defaultDate: string;
  compact?: boolean;
}) {
  const [state, action] = useActionState(createAssignmentAction, undefined);
  const [studentId, setStudentId] = useState(students?.[0]?.id ?? "");
  const visibleSubjects = students ? subjects.filter((s) => s.student_id === studentId) : subjects;

  return (
    <form action={action} className={compact ? "space-y-3" : "card space-y-3"}>
      {!compact && <h2 className="h2">Add a task</h2>}
      {students && (
        <div>
          <label className="label">For</label>
          <select name="student_id" className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Type</label>
          <select name="kind" className="input" defaultValue="homework">
            {(Object.keys(KIND_LABEL) as AssignmentKind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Due date</label>
          <input name="due_date" type="date" className="input" defaultValue={defaultDate} />
        </div>
      </div>
      <div>
        <label className="label">Subject</label>
        {visibleSubjects.length ? (
          <select name="subject_id" className="input" defaultValue="">
            <option value="">— choose —</option>
            {visibleSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        ) : (
          <input name="subject_name" className="input" placeholder="e.g. Math" />
        )}
      </div>
      <div>
        <label className="label">Title</label>
        <input name="title" className="input" required placeholder="e.g. Page 45, exercises 1-10" />
      </div>
      <div>
        <label className="label">Details (optional)</label>
        <textarea name="details" className="input" rows={2} />
      </div>
      <Notice error={state?.error} />
      <SubmitButton className="btn-primary w-full" pendingText="Adding…">Add</SubmitButton>
    </form>
  );
}
