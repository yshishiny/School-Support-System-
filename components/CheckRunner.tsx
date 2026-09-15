"use client";

import { useState } from "react";
import { QuestionFlow } from "./QuestionFlow";
import { submitCheckAction } from "@/lib/actions/wellbeing";
import { INSTRUMENTS, type Instrument } from "@/lib/wellbeing";

export function CheckRunner({ instrument }: { instrument: Instrument }) {
  const def = INSTRUMENTS[instrument];
  const [done, setDone] = useState<{ earned: number; band?: string } | null>(null);
  if (done) {
    return (
      <div className="card text-center space-y-2 pop">
        <div className="text-6xl sticker-still">{done.band === "green" ? "🌟" : "🤝"}</div>
        <p className="h2">Thanks for being honest.</p>
        {done.earned > 0 && <p className="text-3xl font-extrabold text-accent-2">+{done.earned} points</p>}
        <p className="text-sm muted">{done.band === "green" ? "Sounds like a decent week. Keep the routine going." : "Some of that sounds heavy. The coach is in the Talk tab whenever you want, and it is fine to ask a parent for a break."}</p>
        <a href="/coach" className="btn-primary">Back to coach</a>
      </div>
    );
  }
  return (
    <QuestionFlow
      questions={def.questions}
      freeTextPrompt={def.freeText}
      onSubmit={async (answers, free) => {
        const r = await submitCheckAction(instrument, answers, free);
        if (r.error) return { error: r.error };
        setDone({ earned: r.earned ?? 0, band: r.band });
      }}
    />
  );
}
