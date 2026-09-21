"use client";

import { useActionState } from "react";
import { makeResourcesAction, rewriteLessonAction, writeLessonNowAction } from "@/lib/actions/lms";

/** The three things that can be done to a topic's material, wherever it is being looked at. */
export function LessonActions({
  topicId, level, exists, mediaOnly = false, mediaExists = false,
}: { topicId: string; level: "basics" | "advanced"; exists: boolean; mediaOnly?: boolean; mediaExists?: boolean }) {
  const [write, doWrite, writing] = useActionState(writeLessonNowAction, undefined);
  const [again, doRewrite, rewriting] = useActionState(rewriteLessonAction, undefined);
  const [media, doMedia, mediaBusy] = useActionState(makeResourcesAction, undefined);
  const says = [write, again, media].find((s) => s?.error || s?.ok);
  const name = level === "basics" ? "basics" : "deep";

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {!mediaOnly && (
          <form action={exists ? doRewrite : doWrite}>
            <input type="hidden" name="topic_id" value={topicId} />
            <input type="hidden" name="level" value={level} />
            <button className="btn-ghost btn-sm" disabled={writing || rewriting}>
              {writing || rewriting ? "Writing…" : exists ? `Rewrite the ${name} lesson` : `Write the ${name} lesson`}
            </button>
          </form>
        )}
        {mediaOnly && (
          <form action={doMedia}>
            <input type="hidden" name="topic_id" value={topicId} />
            <button className="btn-ghost btn-sm" disabled={mediaBusy}>
              {mediaBusy ? "Making…" : mediaExists ? "Make them again" : "Make diagrams and videos"}
            </button>
          </form>
        )}
      </div>
      {says?.error && <p className="text-[11px] text-bad">{says.error}</p>}
      {says?.ok && <p className="text-[11px] text-good">{says.ok}</p>}
    </div>
  );
}
