"use client";

import { useActionState } from "react";
import { setInterestsAction } from "@/lib/actions/profile";
import { subjectLabel } from "@/lib/plan";
import { Notice, SubmitButton } from "./ui";

export function InterestsForm({ interests, favourites, subjects }: { interests: string | null; favourites: string[]; subjects: string[] }) {
  const [state, action] = useActionState(setInterestsAction, undefined);
  return (
    <form action={action} className="card space-y-3">
      <div>
        <h2 className="h2">🎯 Make my quizzes about…</h2>
        <p className="text-xs muted">Word problems and reading passages use what you like. The coach reads this too.</p>
      </div>
      <div>
        <label className="label">Things I love</label>
        <input name="interests" className="input" defaultValue={interests ?? ""} maxLength={300} placeholder="e.g. Real Madrid, FIFA, cars, space, Marvel" />
      </div>
      <div>
        <label className="label">Favourite subjects (they get first pick on busy days)</label>
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <label key={s} className="chip cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent/20 has-[:checked]:text-accent-2">
              <input type="checkbox" name="favourite" value={s} defaultChecked={favourites.includes(s)} className="sr-only" />
              {subjectLabel(s)}
            </label>
          ))}
        </div>
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Saving…">Save</SubmitButton>
      <Notice error={state?.error} ok={state?.ok ? "Saved. New quizzes will use this." : undefined} />
    </form>
  );
}
