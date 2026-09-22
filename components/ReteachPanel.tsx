"use client";

import { useActionState, useState } from "react";
import ReactMarkdown from "react-markdown";
import { reteachTopicAction } from "@/lib/actions/learning";
import { STYLES, untried, type Retake } from "@/lib/learning/reteach";
import type { Level } from "@/lib/levels";

/**
 * "I don't get it" — offered on every lesson, not only on the ones that were never written.
 *
 * Until now the explain button appeared only where a lesson was missing. A child who read one and did not
 * follow it had no button at all: no way to ask for smaller words, more worked examples, or a different route
 * in. The lesson itself is shared with everyone in his year and is never touched — what he gets back is his.
 */
export function ReteachPanel({ topicId, level, retakes }: { topicId: string; level: Level; retakes: Retake[] }) {
  const [state, act, busy] = useActionState(reteachTopicAction, undefined);
  const [open, setOpen] = useState<string | null>(retakes[0]?.id ?? null);
  const left = untried(retakes);

  return (
    <section className="space-y-2">
      {retakes.length > 0 && (
        <div className="space-y-2">
          {retakes.map((r) => {
            const s = STYLES.find((x) => x.id === r.style)!;
            const isOpen = open === r.id;
            return (
              <div key={r.id} className="card !py-2 space-y-1 border-accent/40">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 text-left"
                  onClick={() => setOpen(isOpen ? null : r.id)}
                >
                  <span>{s.emoji}</span>
                  <span className="flex-1 text-sm font-semibold">{s.label}</span>
                  <span className="muted text-xs">{isOpen ? "hide" : "read"}</span>
                </button>
                {isOpen && (
                  <article className="prose-lesson text-sm leading-relaxed space-y-2 border-t border-line pt-2">
                    <ReactMarkdown>{r.contentMd}</ReactMarkdown>
                    <p className="text-[11px] muted border-t border-line pt-2">
                      Written for you when you asked. The class lesson above has not changed.
                    </p>
                  </article>
                )}
              </div>
            );
          })}
        </div>
      )}

      {left.length > 0 && (
        <div className="card !py-3 space-y-2 border-warn/40">
          <div className="text-sm font-semibold">
            {retakes.length === 0 ? "Didn't get that?" : "Still not clear?"}
          </div>
          <p className="text-xs muted">
            {retakes.length === 0
              ? "Nobody understands everything first time. Pick what would help and it gets written for you — about a minute."
              : "Try another way. Each one is kept, so you can come back to whichever helped."}
          </p>
          <div className="grid gap-1.5">
            {left.map((s) => (
              <form key={s.id} action={act}>
                <input type="hidden" name="topic_id" value={topicId} />
                <input type="hidden" name="level" value={level} />
                <input type="hidden" name="style" value={s.id} />
                <button className="btn-ghost btn-sm w-full !justify-start gap-2" disabled={busy}>
                  <span>{s.emoji}</span>
                  <span className="flex-1 text-left">
                    <span className="block">{s.label}</span>
                    <span className="block text-[11px] muted font-normal">{s.promise}</span>
                  </span>
                </button>
              </form>
            ))}
          </div>
          {busy && <p className="text-xs muted">Writing it for you…</p>}
          {state?.error && <p className="text-xs text-bad">{state.error}</p>}
        </div>
      )}

      {left.length === 0 && retakes.length > 0 && (
        <p className="text-xs muted px-1">
          You have all three versions. If it still will not go in, tell your coach — that is a sign the gap is
          further back, not in this lesson.
        </p>
      )}
    </section>
  );
}
