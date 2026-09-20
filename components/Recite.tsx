"use client";

import { useRef, useState } from "react";
import type { MarkedWord } from "@/lib/recite";

/**
 * Reciting out loud, and being told which word slipped.
 *
 * `memorize_items` has never held a row. The feature asked a child to hide the text and mark himself, which is
 * the one thing a child memorising cannot do — he cannot hear his own mistake. This is the missing half: he
 * recites, and the words come back coloured.
 *
 * The recording is sent, marked and dropped. Nothing keeps his voice.
 */
interface Result {
  words: MarkedWord[];
  score: number;
  correct: number;
  expected: number;
  line: string;
  heard: string;
  lowConfidence: boolean;
}

export function Recite({ itemId, segment, label }: { itemId: string; segment?: string; label?: string }) {
  const [state, setState] = useState<"idle" | "recording" | "marking" | "done" | "unsupported">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    setError(null);
    setResult(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return setState("unsupported");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Whatever this browser can actually make: Chrome gives webm/opus, Safari gives mp4. Both are accepted.
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void send(new Blob(chunks.current, { type: r.mimeType || "audio/webm" }));
      };
      rec.current = r;
      r.start();
      setSeconds(0);
      tick.current = setInterval(() => setSeconds((n) => n + 1), 1000);
      setState("recording");
    } catch {
      setError("The microphone is not allowed. Tap the lock icon in the address bar → Microphone → Allow.");
      setState("idle");
    }
  }

  function stopRecording() {
    if (tick.current) clearInterval(tick.current);
    rec.current?.stop();
    setState("marking");
  }

  async function send(blob: Blob) {
    const body = new FormData();
    body.set("audio", blob);
    body.set("item_id", itemId);
    if (segment) body.set("segment", segment);
    try {
      const res = await fetch("/api/recite", { method: "POST", body });
      const j = (await res.json()) as Result & { error?: string };
      if (!res.ok || j.error) {
        setError(j.error ?? "That did not work. Try again.");
        return setState("idle");
      }
      setResult(j);
      setState("done");
    } catch {
      setError("Could not send the recording. Check the connection and try again.");
      setState("idle");
    }
  }

  const colour = (v: MarkedWord["verdict"]) =>
    v === "correct" ? "" : v === "extra" ? "text-warn line-through" : "text-bad underline decoration-wavy";

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🎙️</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>
            {label ? `Recite: ${label}` : "Recite it from memory"}
          </div>
          <div className="text-xs muted">
            {state === "recording" ? `Listening… ${seconds}s — tap stop when you finish`
              : state === "marking" ? "Listening back…"
              : "Nothing is kept. Only the score and which words slipped."}
          </div>
        </div>
      </div>

      {state === "unsupported" ? (
        <p className="text-xs muted">This browser cannot record. Chrome on Android, or Safari on iPhone with the app added to the home screen.</p>
      ) : state === "recording" ? (
        <button type="button" className="btn-primary w-full" onClick={stopRecording}>⏹ Stop</button>
      ) : state === "marking" ? (
        <button type="button" className="btn-ghost w-full" disabled>Marking…</button>
      ) : (
        <button type="button" className="btn-primary w-full" onClick={startRecording}>
          {result ? "Try again" : "Start reciting"}
        </button>
      )}

      {error && <p className="text-sm text-bad">{error}</p>}

      {result && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>{result.score}%</span>
            <span className="text-sm">{result.line}</span>
          </div>
          <p className="text-xs muted">{result.correct} of {result.expected} words</p>
          <p dir="rtl" className="text-xl leading-loose" style={{ fontFamily: "var(--font-quran, var(--font-arabic))" }}>
            {result.words.map((w, k) => <span key={k} className={colour(w.verdict)}>{w.text} </span>)}
          </p>
          {result.lowConfidence && (
            <p className="text-xs muted">
              It was hard to hear. Somewhere quieter, and hold the phone closer — a word marked wrong here may not have been.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
