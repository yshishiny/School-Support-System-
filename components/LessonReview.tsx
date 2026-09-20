"use client";

import { useState } from "react";
import { confirmLessonAction, rejectLessonAction } from "@/lib/actions/teaching";
import type { ReviewItem } from "@/lib/teaching/queue";

/**
 * The parent's half of the teaching contract.
 *
 * A model can check that a lesson is on its topic, in the right language and worked to its last line. It cannot
 * check what the child's teacher actually covered. This is where that answer is given — and the only screen in the
 * app whose whole purpose is a judgement no model is allowed to make.
 */
export function LessonReview({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) {
    return (
      <p className="card muted text-sm">
        Nothing waiting. Lessons are checked as they are written; anything the checks were unsure about, or stopped
        outright, appears here.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs muted">
        Every lesson is checked before a child reads it. These are the ones only you can settle — you saw the class,
        the checker did not.
      </p>
      {items.map((it) => <Row key={`${it.kind}-${it.lessonId ?? it.ref ?? it.topicId}`} item={it} />)}
    </div>
  );
}

function Row({ item }: { item: ReviewItem }) {
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, setBusy] = useState(false);
  const held = item.kind === "held";

  async function run(fn: (fd: FormData) => Promise<{ error?: string; ok?: string }>, fd: FormData) {
    setBusy(true);
    setMsg(await fn(fd));
    setBusy(false);
  }

  if (msg.ok) return <div className="card !py-2.5 text-sm text-good">{item.topic} · {msg.ok}</div>;

  return (
    <div className={`card !py-3 space-y-2 ${held ? "border-2 border-bad/50" : ""}`}>
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none">{held ? "⛔" : "⚠️"}</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm">{item.topic}</div>
          <div className="text-xs muted">
            {[item.subject, item.unit, item.grade ? `grade ${item.grade}` : null, item.level === "advanced" ? "deeper version" : null]
              .filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-panel-2 p-2 space-y-1">
        <div className="text-[11px] font-bold uppercase tracking-wider muted">
          {held ? "Stopped before anyone read it" : "The checker was not sure about this"}
        </div>
        {item.failed.map((f) => <div key={f.id} className="text-xs">{f.question}</div>)}
      </div>

      {held ? (
        <p className="text-xs muted">
          No child saw this one. A fresh lesson is written the next time the topic is opened.
          {item.ref ? <> Reference <span className="font-mono">{item.ref}</span>.</> : null}
        </p>
      ) : !asking ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button" className="btn-primary btn-sm" disabled={busy}
            onClick={() => { const fd = new FormData(); fd.set("lesson_id", item.lessonId!); void run(confirmLessonAction, fd); }}
          >
            This matched the class
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setAsking(true)}>It did not</button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={400}
            placeholder="What was wrong? The next lesson on this topic is told, so it does not repeat it."
          />
          <div className="flex gap-2">
            <button
              type="button" className="btn-primary btn-sm" disabled={busy || reason.trim().length < 5}
              onClick={() => { const fd = new FormData(); fd.set("lesson_id", item.lessonId!); fd.set("reason", reason); void run(rejectLessonAction, fd); }}
            >
              Send it back
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </div>
      )}
      {msg.error && <p className="text-xs text-bad">{msg.error}</p>}
    </div>
  );
}
