"use client";

import { useRef, useState } from "react";

/**
 * "Show me what you wrote, and I'll tell you where it went wrong."
 *
 * The model has only ever marked multiple choice, which says whether he picked the right letter and nothing about
 * where his method breaks. This is the first time it sees his own work.
 *
 * It deliberately stops short of the answer. He gets the first wrong line and a nudge at the method, and the next
 * try is still his — which is the delegation rule from the teaching model, made real in a screen.
 */
interface Line { text: string; status: "ok" | "wrong" | "unclear"; note: string | null }
interface Result {
  readable: boolean;
  problem: string;
  lines: Line[];
  first_wrong_line: number | null;
  correct: boolean | null;
  what_went_wrong: string;
  hint: string;
}

export function CheckMyWorking({
  topicId, topicName, materialId, title, blurb,
}: {
  topicId?: string;
  topicName?: string;
  /** A school sheet he did on paper. Its text is sent as context so the marking knows the questions. */
  materialId?: string;
  title?: string;
  blurb?: string;
}) {
  const [state, setState] = useState<"idle" | "reading" | "done">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function send(f: File) {
    setError(null);
    setResult(null);
    setState("reading");
    const body = new FormData();
    body.set("photo", f);
    if (topicId) body.set("topic_id", topicId);
    if (materialId) body.set("material_id", materialId);
    try {
      const res = await fetch("/api/working", { method: "POST", body });
      const j = (await res.json()) as Result & { error?: string };
      if (!res.ok || j.error) {
        setError(j.error ?? "That did not work. Try again.");
        return setState("idle");
      }
      setResult(j);
      setState("done");
    } catch {
      setError("Could not send the photo. Check the connection and try again.");
      setState("idle");
    }
  }

  const allRight = result?.readable && result.first_wrong_line === null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">✍️</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>{title ?? "Check my working"}</div>
          <div className="text-xs muted">
            {blurb ?? `${topicName ? `${topicName} · ` : ""}Photograph what you wrote. You will be told where it first goes wrong — not the answer.`}
          </div>
        </div>
      </div>

      <input
        ref={file} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); e.target.value = ""; }}
      />
      <button
        type="button" className="btn-primary w-full" disabled={state === "reading"}
        onClick={() => file.current?.click()}
      >
        {state === "reading" ? "Reading it…" : result ? "Photograph the next try" : "📷 Take a photo"}
      </button>

      {error && <p className="text-sm text-bad">{error}</p>}

      {result && !result.readable && (
        <p className="text-sm">{result.what_went_wrong || "That photo is hard to read — closer, flatter, and more light."}</p>
      )}

      {result?.readable && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl">{allRight ? "✅" : "🔍"}</span>
            <span className="text-sm font-bold">
              {allRight ? "All correct." : `First slip on line ${result.first_wrong_line}.`}
            </span>
          </div>
          {result.problem && result.problem !== "Unclear" && (
            <p className="text-xs muted">{result.problem}</p>
          )}

          <ol className="space-y-1 text-sm">
            {result.lines.map((l, k) => (
              <li
                key={k}
                className={`flex gap-2 rounded-lg px-2 py-1 ${
                  l.status === "wrong" ? "bg-bad/15 border border-bad/40"
                  : l.status === "unclear" ? "opacity-60" : ""
                }`}
              >
                <span className="shrink-0 tabular-nums muted text-xs pt-0.5">{k + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-mono">{l.text}</span>
                  {l.note && <span className="block text-xs text-bad mt-0.5">{l.note}</span>}
                </span>
              </li>
            ))}
          </ol>

          {!allRight && (
            <>
              <p className="text-sm">{result.what_went_wrong}</p>
              <p className="rounded-xl bg-panel-2 p-2 text-sm">💡 {result.hint}</p>
            </>
          )}
          {allRight && <p className="text-sm">{result.what_went_wrong}</p>}
        </div>
      )}
    </div>
  );
}
