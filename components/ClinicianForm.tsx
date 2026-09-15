"use client";

import { useActionState, useState } from "react";
import { generateClinicianReportAction } from "@/lib/actions/clinician";
import { Notice, SubmitButton } from "./ui";

export function ClinicianForm({ studentId, firstName }: { studentId: string; firstName: string }) {
  const [state, action] = useActionState(generateClinicianReportAction, undefined);
  const [scope, setScope] = useState<"standard" | "with_chat_themes">("standard");
  return (
    <form action={action} className="card space-y-3">
      <input type="hidden" name="student_id" value={studentId} />
      <div>
        <h2 className="h2">New summary for a professional</h2>
        <p className="text-xs muted">Written for a child and adolescent psychiatrist or psychologist. It compiles what the app has actually observed over the last eight weeks, labels what is validated, what is self-report and what is machine-generated, and never diagnoses.</p>
      </div>
      <div>
        <label className="label">Why are you seeking the consultation? (your words; it goes in the report)</label>
        <textarea name="reason" className="input" rows={3} maxLength={2000} placeholder="e.g. Since September he has seemed withdrawn, sleeps late, and says school is pointless…" />
      </div>
      <div className="space-y-2">
        <label className="label">What to include</label>
        <label className="tile flex items-start gap-3 cursor-pointer">
          <input type="radio" name="scope" value="standard" checked={scope === "standard"} onChange={() => setScope("standard")} className="mt-1" />
          <span className="text-sm"><b>Standard</b> <span className="muted">· screening scores, weekly pulse, academic functioning, routine, safety flags, the AI&apos;s one-line notes. His private chat is excluded and the report says so.</span></span>
        </label>
        <label className="tile flex items-start gap-3 cursor-pointer">
          <input type="radio" name="scope" value="with_chat_themes" checked={scope === "with_chat_themes"} onChange={() => setScope("with_chat_themes")} className="mt-1" />
          <span className="text-sm"><b>Also themes from his chat with the coach</b> <span className="muted">· themes only, never quotes. He was promised privacy, so this needs his agreement and he will see in the app that it was shared.</span></span>
        </label>
      </div>
      {scope === "with_chat_themes" && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="child_informed" className="mt-1" />
          <span>I have told {firstName} that a summary including themes from his coach chat is going to a professional, and he agrees.</span>
        </label>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" className="mt-1" />
        <span>I am sharing this with a licensed professional for {firstName}&apos;s care. I understand it is collateral information, not an assessment.</span>
      </label>
      <SubmitButton className="btn-primary w-full" pendingText="Compiling and writing… about a minute">Generate summary</SubmitButton>
      <Notice error={state?.error} ok={state?.id ? "Summary ready below. Use Print to save it as a PDF." : undefined} />
    </form>
  );
}
