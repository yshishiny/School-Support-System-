"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runAction } from "@/lib/client-action";
import { createQuizAction, explainTopicAction } from "@/lib/actions/learning";
import { Notice, SubmitButton } from "./ui";

export function PracticeButton({ topicId, actSection, recall = false, label = "Practice", difficulty = "medium", className = "btn-primary" }: { topicId?: string; actSection?: string; recall?: boolean; label?: string; difficulty?: string; className?: string }) {
  const [state, action] = useActionState(createQuizAction, undefined);
  return (
    <form action={action} className="space-y-1">
      {topicId && <input type="hidden" name="topic_id" value={topicId} />}
      {actSection && <input type="hidden" name="act_section" value={actSection} />}
      {recall && <input type="hidden" name="recall" value="1" />}
      <input type="hidden" name="difficulty" value={difficulty} />
      <SubmitButton className={className} pendingText="Writing questions… up to 90s">{label}</SubmitButton>
      <Notice error={state?.error} />
    </form>
  );
}

export function ExplainButton({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const run = useCallback(() => {
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("topic_id", topicId);
      const r = await runAction(() => explainTopicAction(undefined, fd), setError);
      if (!r) return;
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }, [topicId, router]);
  useEffect(() => {
    // Arriving from "we haven't taken this yet": start writing the lesson at once.
    if (!auto && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("explain") === "1") { setAuto(true); run(); }
  }, [auto, run]);
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className="btn-primary w-full" onClick={run}>{pending ? "Writing the lesson… up to 90 seconds, stay on this page" : "📖 Explain this topic to me"}</button>
      {error && <p className="text-sm text-bad">{error} <button type="button" className="underline" onClick={run}>Try again</button></p>}
    </div>
  );
}
