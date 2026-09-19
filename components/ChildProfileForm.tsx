"use client";

import { useActionState } from "react";
import { updateChildProfileAction } from "@/lib/actions/children";
import { STAGES } from "@/lib/people";
import { Notice, SubmitButton } from "./ui";
import type { Profile } from "@/lib/types";

/** Everything personal about a child, editable by the parent. The coach reads the notes. */
export function ChildProfileForm({ s, age, username }: { s: Profile; age: number | null; username: string | null }) {
  const [state, action] = useActionState(updateChildProfileAction, undefined);
  return (
    <form action={action} className="card space-y-3">
      <input type="hidden" name="student_id" value={s.id} />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label">Full name</label><input name="full_name" className="input" defaultValue={s.full_name} required /></div>
        <div><label className="label">Date of birth{age !== null ? ` · ${age} years` : ""}</label><input name="birth_date" type="date" className="input" defaultValue={s.birth_date ?? ""} /></div>
        <div><label className="label">Stage</label>
          <select name="stage" className="input" defaultValue={s.stage ?? "school"}>{STAGES.map((x) => <option key={x.id} value={x.id}>{x.emoji} {x.label}</option>)}</select>
        </div>
        <div><label className="label">Grade (school only)</label><input name="grade" type="number" min={1} max={12} className="input" defaultValue={s.grade ?? ""} /></div>
        <div><label className="label">Gender</label>
          <select name="gender" className="input" defaultValue={s.gender ?? ""}><option value="">—</option><option value="boy">Boy</option><option value="girl">Girl</option><option value="other">Other</option></select>
        </div>
        <div><label className="label">School / university</label><input name="school_name" className="input" defaultValue={s.school_name ?? ""} placeholder="KIS American Division" /></div>
        <div><label className="label">Phone</label><input name="phone" className="input" inputMode="tel" defaultValue={s.phone ?? ""} /></div>
        <div><label className="label">Avatar emoji</label><input name="avatar_emoji" className="input" defaultValue={s.avatar_emoji} /></div>
        <div><label className="label">Login username</label><input className="input" value={username ?? ""} readOnly /></div>
        <div className="col-span-2"><label className="label">Notes for the coach (strengths, health, what upsets him, what motivates him)</label><textarea name="parent_notes" className="input" rows={3} defaultValue={s.parent_notes ?? ""} maxLength={1500} /></div>
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="rater" defaultChecked={!!s.rater} /> Older sibling: may tick the others&apos; manners and dish, and approve their snap pictures (never her own; you see every decision)</label>
        <div className="col-span-2"><label className="label">New password (leave empty to keep)</label><input name="new_password" type="text" className="input" minLength={6} placeholder="6+ characters" /></div>
      </div>
      <Notice error={state?.error} ok={state?.ok} />
      <SubmitButton pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}
