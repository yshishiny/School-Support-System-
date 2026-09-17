"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { askTeacherAction, finishLessonAction, recordBeatAction } from "@/lib/actions/teach";
import type { Character } from "@/lib/characters";
import type { LessonScript } from "@/lib/ai/lesson-script";
import { runAction } from "@/lib/client-action";

type Beat = LessonScript["beats"][number];

/** Browser speech: picks a voice for the language, honours the character's rate and pitch. */
function useSpeech(language: "en" | "ar", c: Character) {
  const [speaking, setSpeaking] = useState(false);
  const [available, setAvailable] = useState(true);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return setAvailable(false);
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      const lang = language === "ar" ? "ar" : "en";
      const cands = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
      const byGender = c.voice.preferFemale ? cands.find((v) => /female|zira|samantha|salma|hoda|laila/i.test(v.name)) : cands.find((v) => /male|david|daniel|naayf|hamed/i.test(v.name));
      voiceRef.current = byGender ?? cands.find((v) => v.localService) ?? cands[0] ?? null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [language, c]);
  const stop = useCallback(() => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); setSpeaking(false); }, []);
  const say = useCallback((text: string, onEnd?: () => void) => {
    if (!("speechSynthesis" in window)) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language === "ar" ? "ar-EG" : "en-US";
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = c.voice.rate;
    u.pitch = c.voice.pitch;
    u.onstart = () => setSpeaking(true);
    u.onend = () => { setSpeaking(false); onEnd?.(); };
    u.onerror = () => { setSpeaking(false); onEnd?.(); };
    window.speechSynthesis.speak(u);
  }, [language, c]);
  return { say, stop, speaking, available };
}

function Visual({ show, rtl }: { show: Beat["show"]; rtl: boolean }) {
  if (!show) return null;
  if (show.type === "svg") return <div className="rounded-xl bg-white/90 p-2 [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: show.content.replace(/<script[\s\S]*?<\/script>/gi, "") }} />;
  if (show.type === "formula") return <div className="rounded-xl bg-panel-2 p-3 text-center text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{show.content}</div>;
  if (show.type === "steps") return <ol className="rounded-xl bg-panel-2 p-3 text-sm list-decimal pl-6 space-y-1">{show.content.split("\n").filter(Boolean).map((l, i) => <li key={i}>{l.replace(/^\d+[.)]\s*/, "")}</li>)}</ol>;
  if (show.type === "table") return <table className="w-full text-sm rounded-xl overflow-hidden bg-panel-2"><tbody>{show.content.split("\n").filter(Boolean).map((r, i) => <tr key={i} className={i === 0 ? "font-bold" : ""}>{r.split("|").map((cell, k) => <td key={k} className="px-2 py-1 border-b border-line">{cell.trim()}</td>)}</tr>)}</tbody></table>;
  return <div className={`rounded-xl bg-panel-2 p-3 text-sm whitespace-pre-wrap ${rtl ? "text-right" : ""}`}>{show.content}</div>;
}

/** The lesson stage: the teacher speaks each beat, shows a visual, stops for checks, answers raised hands. */
export function Stage({ sessionId, scriptId, character, script, language, startBeat, minutes }: { sessionId: string; scriptId: string; character: Character; script: LessonScript; language: "en" | "ar"; startBeat: number; minutes: number }) {
  const { say, stop, speaking, available } = useSpeech(language, character);
  const [i, setI] = useState(Math.min(startBeat, script.beats.length - 1));
  const [chosen, setChosen] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [checkDone, setCheckDone] = useState(false);
  const [hand, setHand] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const started = useRef(Date.now());
  const beat = script.beats[i];
  const rtl = language === "ar";
  const total = script.beats.length;
  const isLast = i === total - 1;

  const speakBeat = useCallback((b: Beat) => { say(b.say); }, [say]);
  useEffect(() => { if (beat) speakBeat(beat); return () => stop(); }, [i, beat, speakBeat, stop]);

  function go(next: number) {
    stop();
    setChosen(null); setAttempts(0); setCheckDone(false); setAnswer(null); setHand(false);
    setI(next);
    void recordBeatAction(sessionId, next);
  }

  function pick(k: number) {
    if (!beat.check || checkDone) return;
    const correct = k === beat.check.correct_index;
    const n = attempts + 1;
    setChosen(k); setAttempts(n);
    if (correct || n >= 2) {
      setCheckDone(true);
      say(correct ? beat.check.explanation : `${beat.check.hint} ${beat.check.explanation}`);
      void recordBeatAction(sessionId, i, { correct, attempts: n });
    } else {
      say(beat.check.hint);
    }
  }

  const progress = useMemo(() => Math.round((i / Math.max(1, total - 1)) * 100), [i, total]);

  return (
    <div className="space-y-3" dir={rtl ? "rtl" : undefined}>
      <div className="flex items-center gap-3">
        <Avatar c={character} speaking={speaking} size={120} mood={checkDone && chosen === beat.check?.correct_index ? "happy" : "neutral"} />
        <div className="flex-1 min-w-0">
          <div className="text-xs muted">{character.name} · {script.title}</div>
          <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden mt-1"><div className="h-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${progress}%` }} /></div>
          <div className="text-[11px] muted mt-1">{i + 1} / {total} · about {minutes} min{!available ? " · this browser has no voice, read the captions" : ""}</div>
          <div className="flex gap-1.5 mt-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => speakBeat(beat)}>🔁 Say again</button>
            {speaking && <button type="button" className="btn-ghost btn-sm" onClick={stop}>⏸ Pause</button>}
            <button type="button" className={`btn-ghost btn-sm ${hand ? "border-accent" : ""}`} onClick={() => { stop(); setHand((h) => !h); }}>✋ Raise hand</button>
          </div>
        </div>
      </div>

      <section className="card space-y-3">
        <p className="text-base leading-relaxed">{beat.say}</p>
        <Visual show={beat.show} rtl={rtl} />
        {beat.kind === "check" && beat.check && (
          <div className="space-y-2">
            <p className="font-semibold">{beat.check.question}</p>
            <div className="grid gap-2">
              {beat.check.choices.map((c, k) => {
                let cls = "border-line hover:border-accent";
                if (checkDone) cls = k === beat.check!.correct_index ? "border-good bg-good/15" : k === chosen ? "border-bad bg-bad/15" : "border-line opacity-60";
                else if (chosen === k) cls = "border-bad bg-bad/15";
                return <button key={k} type="button" disabled={checkDone} onClick={() => pick(k)} className={`text-left rounded-xl border px-3 py-2 ${cls}`}>{c}</button>;
              })}
            </div>
            {!checkDone && attempts === 1 && <p className="text-xs text-warn">{beat.check.hint}</p>}
            {checkDone && <p className="text-xs muted">{beat.check.explanation}</p>}
          </div>
        )}
      </section>

      {hand && (
        <section className="card space-y-2">
          <div className="flex gap-2">
            <input className="input flex-1" placeholder={rtl ? "اسأل المعلم…" : "Ask the teacher…"} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={400} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (document.getElementById("ask-btn") as HTMLButtonElement | null)?.click(); } }} />
            <button id="ask-btn" type="button" disabled={pending || question.trim().length < 2} className="btn-primary" onClick={() => start(async () => { setAnswer(null); setMsg(null); const r = await runAction(() => askTeacherAction(sessionId, i, question), setMsg); if (!r) return; if (r.error) return setMsg(r.error); setAnswer(r.answer ?? null); setQuestion(""); if (r.answer) say(r.answer); })}>{pending ? "…" : "Ask"}</button>
          </div>
          {answer && <p className="text-sm">🧑‍🏫 {answer}</p>}
          {msg && <p className="text-xs text-bad">{msg}</p>}
        </section>
      )}

      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-ghost" disabled={i === 0} onClick={() => go(i - 1)}>← Back</button>
        {!isLast ? (
          <button type="button" className="btn-primary" disabled={beat.kind === "check" && !checkDone} onClick={() => go(i + 1)}>{beat.kind === "check" && !checkDone ? "Answer first" : "Next →"}</button>
        ) : (
          <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => { stop(); const r = await runAction(() => finishLessonAction(sessionId, (Date.now() - started.current) / 1000), setMsg); if (r?.error) setMsg(r.error); })}>{pending ? "…" : "Finish · 3 quick questions"}</button>
        )}
      </div>
      {msg && !hand && <p className="text-xs text-bad">{msg}</p>}
      <details className="text-xs muted"><summary className="cursor-pointer">Something wrong in this lesson?</summary><FlagButton scriptId={scriptId} /></details>
    </div>
  );
}

function FlagButton({ scriptId }: { scriptId: string }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p className="mt-1">Thanks. It will be rewritten with the strongest model next time.</p>;
  return <button type="button" disabled={pending} className="btn-ghost btn-sm mt-1" onClick={() => start(async () => { const { flagLessonAction } = await import("@/lib/actions/teach"); await flagLessonAction(scriptId); setDone(true); })}>🚩 Flag a wrong fact</button>;
}
