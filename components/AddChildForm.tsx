"use client";

import { useActionState } from "react";
import { createChildAction } from "@/lib/actions/children";
import { Notice, SubmitButton } from "./ui";

export function AddChildForm() {
  const [state, action] = useActionState(createChildAction, undefined);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="h2">Add a child</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Full name</label>
          <input name="full_name" className="input" required />
        </div>
        <div>
          <label className="label">Stage</label>
          <select name="stage" className="input" defaultValue="school"><option value="school">🎒 School</option><option value="university">🎓 University</option><option value="postgraduate">📚 Postgraduate</option><option value="adult">💼 Adult learner</option></select>
        </div>
        <div>
          <label className="label">Grade (school only)</label>
          <input name="grade" type="number" min={1} max={12} className="input" />
        </div>
        <div>
          <label className="label">Date of birth</label>
          <input name="birth_date" type="date" className="input" />
        </div>
        <div>
          <label className="label">Avatar emoji</label>
          <input name="avatar_emoji" className="input" defaultValue="🦁" />
        </div>
        <div>
          <label className="label">Login username</label>
          <input name="username" className="input" required autoCapitalize="none" placeholder="youssef" />
        </div>
        <div>
          <label className="label">Password (6+)</label>
          <input name="password" type="text" className="input" required minLength={6} />
        </div>
        <div className="col-span-2">
          <label className="label">Subjects (comma separated)</label>
          <input name="subjects" className="input" placeholder="Math, English, Biology, Chemistry, Physics, Social Studies, Arabic" />
        </div>
      </div>
      <Notice error={state?.error} ok={state?.ok} />
      <SubmitButton pendingText="Creating…">Create account</SubmitButton>
    </form>
  );
}
