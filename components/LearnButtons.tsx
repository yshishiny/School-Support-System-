"use client";

import { useActionState } from "react";
import { createQuizAction, explainTopicAction } from "@/lib/actions/learning";
import { Notice, SubmitButton } from "./ui";

export function PracticeButton({ topicId, actSection, label = "Practice", difficulty = "medium", className = "btn-primary" }: { topicId?: string; actSection?: string; label?: string; difficulty?: string; className?: string }) {
  const [state, action] = useActionState(createQuizAction, undefined);
  return (
    <form action={action} className="space-y-1">
      {topicId && <input type="hidden" name="topic_id" value={topicId} />}
      {actSection && <input type="hidden" name="act_section" value={actSection} />}
      <input type="hidden" name="difficulty" value={difficulty} />
      <SubmitButton className={className} pendingText="Writing questions… (20–40s)">{label}</SubmitButton>
      <Notice error={state?.error} />
    </form>
  );
}

export function ExplainButton({ topicId }: { topicId: string }) {
  const [state, action] = useActionState(explainTopicAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="topic_id" value={topicId} />
      <SubmitButton className="btn-primary w-full" pendingText="Writing the lesson… (20–40s)">📖 Explain this topic to me</SubmitButton>
      <Notice error={state?.error} />
    </form>
  );
}
