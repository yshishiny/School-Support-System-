"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Level } from "@/lib/levels";
import { runAction } from "@/lib/client-action";
import { addResourcesAction, createQuizAction, explainTopicAction, prepareWeekAction } from "@/lib/actions/learning";
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

export function ExplainButton({ topicId, level = "basics" }: { topicId: string; level?: Level }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const run = useCallback(() => {
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("topic_id", topicId);
      fd.set("level", level);
      const r = await runAction(() => explainTopicAction(undefined, fd), setError);
      if (!r) return;
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }, [topicId, level, router]);
  useEffect(() => {
    // Arriving from "we haven't taken this yet": start writing the lesson at once.
    if (!auto && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("explain") === "1") { setAuto(true); run(); }
  }, [auto, run]);
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className="btn-primary w-full" onClick={run}>{pending ? "Writing the lesson… up to 90 seconds, stay on this page" : level === "advanced" ? "🎓 Write the deeper lesson" : "📖 Explain this topic to me"}</button>
      {error && <p className="text-sm text-bad">{error} <button type="button" className="underline" onClick={run}>Try again</button></p>}
    </div>
  );
}

export function AddResourcesButton({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = () =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("topic_id", topicId);
      const r = await runAction(() => addResourcesAction(undefined, fd), setError);
      if (!r) return;
      if (r.error) setError(r.error);
      else router.refresh();
    });
  return (
    <div className="space-y-1">
      <button type="button" disabled={pending} className="btn-ghost w-full" onClick={run}>{pending ? "Drawing and finding videos… about a minute" : "🖼️ Add diagrams and video lessons"}</button>
      {error && <p className="text-sm text-bad">{error} <button type="button" className="underline" onClick={run}>Try again</button></p>}
    </div>
  );
}

export function PrepareWeekButton({ missing }: { missing: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = () =>
    start(async () => {
      setMsg(null);
      const r = await runAction(() => prepareWeekAction(), setMsg);
      if (!r) return;
      if (r.error) setMsg(r.error);
      else {
        setMsg(r.remaining ? `${r.prepared} ready · ${r.remaining} more to go, press again` : "All of this week is ready ✅");
        router.refresh();
      }
    });
  return (
    <div className="space-y-1">
      <button type="button" disabled={pending} className="btn-primary w-full" onClick={run}>{pending ? "Getting this week ready… up to 3 topics a press, stay on this page" : `⚡ Get this week ready (${missing} topic${missing === 1 ? "" : "s"} missing)`}</button>
      {msg && <p className="text-xs muted">{msg}</p>}
    </div>
  );
}
