"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Teacher } from "./Teacher";
import { Classroom } from "./Classroom";
import { Board } from "./Board";
import { Scratchpad } from "./Scratchpad";
import { Confetti } from "./Confetti";
import { useRecognition, useSpeech } from "./useSpeech";
import { askTeacherAction, finishLessonAction, recordBeatAction } from "@/lib/actions/teach";
import type { Character } from "@/lib/characters";
import type { LessonScript } from "@/lib/ai/lesson-script";
import { beatLabel, cameraFor, gestureFor, moodFor, revealCount, wordsOf, boardLines, type Camera, type Gesture, type Mood } from "@/lib/teach/performance";
import { runAction } from "@/lib/client-action";

type Beat = LessonScript["beats"][number];
type Phase = "intro" | "lesson" | "outro";

const ADVANCE_MS = 1300;

function Caption({ text, wordIndex, rtl }: { text: string; wordIndex: number; rtl: boolean }) {
  const words = useMemo(() => wordsOf(text), [text]);
  return (
    <p className={`text-[clamp(.95rem,2.3vw,1.3rem)] leading-relaxed font-semibold text-white/85 ${rtl ? "font-arabic text-right" : ""}`} dir={rtl ? "rtl" : undefined}>
      {words.map((w, k) => <span key={k} className={`caption-word ${k < wordIndex ? "said" : k === wordIndex ? "now" : ""}`}>{w} </span>)}
    </p>
  );
}

/**
 * The lesson as a performance: the teacher walks in, the board fills as they speak, the camera follows,
 * checks stop the flow until answered, a raised hand pauses for a question, and the recap ends with confetti.
 * `demo` runs the same stage with no server calls.
 */
export function Stage({ sessionId, scriptId, character, script, language, startBeat, minutes, demo = false }: { sessionId: string; scriptId: string; character: Character; script: LessonScript; language: "en" | "ar"; startBeat: number; minutes: number; demo?: boolean }) {
  const c = character;
  const rtl = language === "ar";
  const beats = script.beats;
  const total = beats.length;
  const speech = useSpeech(language, c);
  const mic = useRecognition(language);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>(startBeat > 0 ? "lesson" : "intro");
  const [i, setI] = useState(Math.min(startBeat, total - 1));
  const [auto, setAuto] = useState(true);
  const [line, setLine] = useState("");
  const [gestureOverride, setGestureOverride] = useState<Gesture | null>(null);
  const [moodOverride, setMoodOverride] = useState<Mood | null>(null);
  const [walking, setWalking] = useState(startBeat === 0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [checkDone, setCheckDone] = useState(false);
  const [hand, setHand] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [pad, setPad] = useState(false);
  const [burst, setBurst] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const autoRef = useRef(auto);
  const advanceRef = useRef<number | null>(null);
  const startedAt = useRef(Date.now());
  const correctCount = useRef(0);
  const beat: Beat | undefined = beats[i];

  useEffect(() => { autoRef.current = auto; }, [auto]);

  const speak = useCallback((text: string, onEnd?: () => void) => { setLine(text); speech.say(text, onEnd); }, [speech]);
  const cancelAdvance = () => { if (advanceRef.current) { window.clearTimeout(advanceRef.current); advanceRef.current = null; } };

  const goTo = useCallback((next: number) => {
    cancelAdvance();
    speech.stop();
    setChosen(null); setAttempts(0); setCheckDone(false); setAnswer(null); setHand(false); setGestureOverride(null); setMoodOverride(null);
    if (next >= total) { setPhase("outro"); return; }
    setPhase("lesson");
    setI(next);
    if (!demo) void recordBeatAction(sessionId, next);
  }, [demo, sessionId, speech, total]);

  const scheduleAdvance = useCallback((from: number) => {
    cancelAdvance();
    if (!autoRef.current) return;
    advanceRef.current = window.setTimeout(() => goTo(from + 1), ADVANCE_MS);
  }, [goTo]);

  // Intro: walk in, wave, greet, announce the lesson.
  useEffect(() => {
    if (phase !== "intro" || !started) return;
    const t1 = window.setTimeout(() => {
      setWalking(false);
      setGestureOverride("wave");
      setMoodOverride("happy");
      const hello = rtl ? c.lines.hello_ar : c.lines.hello;
      const today = rtl ? `درس اليوم: ${script.title}.` : `Today's lesson: ${script.title}.`;
      speak(`${hello} ${today}`, () => { setGestureOverride(null); setMoodOverride(null); scheduleAdvance(-1); });
    }, 1700);
    return () => window.clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, started]);

  // Each beat: say it; afterwards wait at a check, else advance when on auto.
  useEffect(() => {
    if (phase !== "lesson" || !beat || !started) return;
    speak(beat.say, () => { if (beat.kind !== "check") scheduleAdvance(i); });
    return () => { cancelAdvance(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, i, started]);

  // Outro: celebrate.
  useEffect(() => {
    if (phase !== "outro") return;
    setGestureOverride("celebrate"); setMoodOverride("happy"); setBurst((b) => b + 1);
    const done = rtl ? "انتهى الدرس! أحسنت. والآن ثلاثة أسئلة سريعة." : "Lesson complete! Well done. Now three quick questions.";
    speak(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function pick(k: number) {
    if (!beat?.check || checkDone) return;
    const correct = k === beat.check.correct_index;
    const n = attempts + 1;
    setChosen(k); setAttempts(n);
    if (correct) {
      correctCount.current += 1;
      setCheckDone(true); setGestureOverride("celebrate"); setMoodOverride("happy"); setBurst((b) => b + 1);
      speak(`${rtl ? c.lines.correct_ar : c.lines.correct} ${beat.check.explanation}`, () => { setGestureOverride(null); setMoodOverride(null); scheduleAdvance(i); });
      if (!demo) void recordBeatAction(sessionId, i, { correct: true, attempts: n });
    } else if (n >= 2) {
      setCheckDone(true); setGestureOverride("explain"); setMoodOverride("encourage");
      speak(`${beat.check.hint} ${beat.check.explanation}`, () => { setGestureOverride(null); setMoodOverride(null); scheduleAdvance(i); });
      if (!demo) void recordBeatAction(sessionId, i, { correct: false, attempts: n });
    } else {
      setGestureOverride("oops"); setMoodOverride("sad");
      speak(`${rtl ? c.lines.wrong_ar : c.lines.wrong} ${beat.check.hint}`, () => { setGestureOverride("think"); setMoodOverride("think"); });
    }
  }

  function togglePlay() {
    if (speech.paused) { speech.resume(); return; }
    if (speech.speaking) { cancelAdvance(); speech.pause(); return; }
    if (phase === "lesson" && beat) speak(beat.say, () => { if (beat.kind !== "check") scheduleAdvance(i); });
  }

  function raiseHand() {
    cancelAdvance();
    if (hand) { setHand(false); setGestureOverride(null); return; }
    speech.stop(); setHand(true); setAnswer(null); setGestureOverride("listen"); setMoodOverride("neutral");
  }

  function ask() {
    const q = question.trim();
    if (q.length < 2) return;
    start(async () => {
      setMsg(null);
      let text: string | null = null;
      if (demo) {
        text = rtl ? "سؤال جيد! في العرض التجريبي لا أستطيع التفكير، لكن في الدرس الحقيقي أجيب بشخصيتي ثم نعود إلى الدرس." : "Good question! In this demo I can't think it through, but in a real lesson I answer in character and then we go back to the lesson.";
      } else {
        const r = await runAction(() => askTeacherAction(sessionId, i, q), setMsg);
        if (!r) return;
        if (r.error) { setMsg(r.error); return; }
        text = r.answer ?? null;
      }
      setQuestion(""); setAnswer(text);
      if (text) { setGestureOverride("explain"); setMoodOverride("encourage"); speak(text, () => { setGestureOverride(null); setMoodOverride(null); }); }
    });
  }

  function finish() {
    speech.stop();
    if (demo) { setMsg(rtl ? "هذا عرض تجريبي. سجّل الدخول لتبدأ دروسك." : "This was a demo. Sign in to start your own lessons."); return; }
    start(async () => { const r = await runAction(() => finishLessonAction(sessionId, (Date.now() - startedAt.current) / 1000), setMsg); if (r?.error) setMsg(r.error); });
  }

  const gesture: Gesture = gestureOverride ?? (phase === "lesson" && beat ? (speech.speaking ? gestureFor(beat) : beat.kind === "check" ? "think" : "idle") : "idle");
  const mood: Mood = moodOverride ?? (phase === "lesson" && beat ? moodFor(beat) : "happy");
  const camera: Camera = hand ? "teacher" : phase === "lesson" && beat && speech.speaking ? cameraFor(beat) : "wide";
  const lines = beat?.show ? boardLines(beat.show).length : 0;
  const revealed = phase !== "lesson" ? 0 : speech.speaking ? revealCount(lines, speech.wordIndex / Math.max(1, speech.wordCount - 1)) : lines;
  const progress = phase === "outro" ? 100 : phase === "intro" ? 0 : Math.round((i / Math.max(1, total)) * 100);
  const label = phase === "intro" ? (rtl ? "البداية" : "Welcome") : phase === "outro" ? (rtl ? "النهاية" : "Done") : beat ? beatLabel(beat.kind).label : "";
  const exitHref = demo ? "/login" : "/teach";

  const boardBody = (
    <>
      {phase === "intro" && (
        <div className="h-full flex flex-col items-center justify-center text-center gap-2 title-card">
          <div className="text-[11px] uppercase tracking-wider text-[#ffd166]">{rtl ? "درس اليوم" : "Today's lesson"}</div>
          <div className="text-[clamp(1.3rem,4.5vw,2.4rem)] font-bold leading-tight">{script.title}</div>
          <div className="text-sm text-white/70">{rtl ? "مع" : "with"} {c.name} · ~{minutes} {rtl ? "دقيقة" : "min"}</div>
        </div>
      )}
      {phase === "outro" && (
        <div className="h-full flex flex-col items-center justify-center text-center gap-3 title-card">
          <div className="text-5xl">🏁</div>
          <div className="text-[clamp(1.2rem,4vw,2rem)] font-bold">{rtl ? "انتهى الدرس!" : "Lesson complete!"}</div>
          <div className="text-sm text-white/75">{rtl ? "إجابات صحيحة" : "Checks right"}: {correctCount.current} / {beats.filter((b) => b.kind === "check").length}</div>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            <button type="button" className="btn-primary" disabled={pending} onClick={finish}>{pending ? "…" : demo ? (rtl ? "جرّب درساً حقيقياً" : "Try a real lesson") : (rtl ? "٣ أسئلة سريعة" : "Finish · 3 quick questions")}</button>
            <button type="button" className="btn-ghost" onClick={() => { correctCount.current = 0; setWalking(true); setPhase("intro"); setI(0); }}>{rtl ? "إعادة" : "Watch again"}</button>
          </div>
          {msg && <p className="text-xs text-[#ffd166]">{msg}</p>}
          {!demo && <details className="text-xs text-white/60"><summary className="cursor-pointer">Something wrong in this lesson?</summary><FlagButton scriptId={scriptId} /></details>}
        </div>
      )}
      {phase === "lesson" && beat?.kind === "check" && beat.check && (
        <div className="space-y-3">
          <p className="font-bold text-[clamp(1.05rem,2.8vw,1.4rem)] leading-snug">{beat.check.question}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {beat.check.choices.map((ch, k) => {
              let cls = "border-white/25 bg-white/5 hover:bg-white/15";
              if (checkDone) cls = k === beat.check!.correct_index ? "border-good bg-good/25" : k === chosen ? "border-bad bg-bad/25" : "border-white/10 opacity-50";
              else if (chosen === k) cls = "border-bad bg-bad/25";
              return <button key={k} type="button" disabled={checkDone} onClick={() => pick(k)} className={`choice-card text-start rounded-2xl border-2 px-3 py-2.5 text-[clamp(.95rem,2.4vw,1.15rem)] font-semibold transition ${cls}`} style={{ animationDelay: `${k * 0.12}s` }}><span className="me-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#ffd166] text-[#2b1d2e] text-xs">{"ABCD"[k]}</span>{ch}</button>;
            })}
          </div>
        </div>
      )}
    </>
  );

  const overlay = (
    <>
      <Confetti burst={burst} />
      {!started && (
        <button type="button" onClick={() => { speech.unlock(); setStarted(true); }} className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-[2px] text-white" dir={rtl ? "rtl" : undefined}>
          <span className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-white text-[#2b1d2e] text-4xl shadow-2xl pulse">▶</span>
          <span className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{rtl ? "اضغط لبدء الدرس" : "Tap to start the lesson"}</span>
          <span className="text-sm text-white/80">{c.name} · {script.title}</span>
          <span className="text-xs text-white/60">{rtl ? "ارفع الصوت 🔊" : "Turn the sound up 🔊"}</span>
        </button>
      )}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-3 pt-[max(.5rem,env(safe-area-inset-top))]" dir={rtl ? "rtl" : undefined}>
        <Link href={exitHref} className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur" aria-label="Exit">✕</Link>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white drop-shadow truncate">{c.name} · {script.title}</div>
          <div className="mt-1 flex items-center gap-1">
            {beats.map((b, k) => { const bl = beatLabel(b.kind); return <button key={k} type="button" title={bl.label} onClick={() => goTo(k)} className={`h-2.5 flex-1 max-w-8 rounded-full transition ${k < i || phase === "outro" ? "bg-[#ffd166]" : k === i && phase === "lesson" ? "bg-white scale-y-150" : "bg-white/30"}`} aria-label={`${bl.label} ${k + 1}`} />; })}
          </div>
        </div>
        <button type="button" onClick={() => setAuto((a) => !a)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold backdrop-blur ${auto ? "bg-good/80 text-white" : "bg-black/40 text-white/80"}`}>{auto ? (rtl ? "تلقائي" : "Auto ▶") : (rtl ? "يدوي" : "Manual")}</button>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 px-3 pb-[max(.5rem,env(safe-area-inset-bottom))]">
        {hand && (
          <div className="rounded-2xl bg-black/60 backdrop-blur p-2 space-y-2" dir={rtl ? "rtl" : undefined}>
            <div className="flex gap-2">
              {mic.supported && <button type="button" className={`h-11 w-11 shrink-0 rounded-full text-lg ${mic.listening ? "bg-bad pulse" : "bg-white/15"}`} onClick={() => (mic.listening ? mic.stop() : mic.start((t) => setQuestion(t)))} aria-label="Speak your question">🎤</button>}
              <input className="input flex-1 !py-2" placeholder={mic.listening ? (rtl ? "أستمع…" : "Listening…") : rtl ? "اسأل المعلم…" : "Ask the teacher…"} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={400} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ask(); } }} />
              <button type="button" disabled={pending || question.trim().length < 2} className="btn-primary !py-2" onClick={ask}>{pending ? "…" : rtl ? "اسأل" : "Ask"}</button>
            </div>
            {answer && <p className="text-xs text-white/80">{answer}</p>}
            {msg && <p className="text-xs text-bad">{msg}</p>}
          </div>
        )}
        <div className="rounded-2xl bg-black/55 backdrop-blur px-3 py-2 min-h-[3.4rem] max-h-[19vh] overflow-auto">
          {line ? <Caption text={line} wordIndex={speech.speaking || speech.paused ? speech.wordIndex : 9999} rtl={rtl} /> : <p className="text-sm text-white/60">{rtl ? "…" : "…"}</p>}
          {speech.blocked ? <p className="text-[11px] text-[#ffd166] mt-1">{rtl ? "اضغط ▶ لتسمع المعلم." : "Tap ▶ to hear the teacher."}</p> : !speech.available && <p className="text-[11px] text-[#ffd166] mt-1">{rtl ? "لا يوجد صوت في هذا المتصفح، اقرأ النص." : "No voice on this browser: read along."}</p>}
        </div>
        <div className="stage-controls flex items-center justify-between gap-1 rounded-2xl bg-black/55 backdrop-blur px-1.5 py-1 text-white" dir={rtl ? "rtl" : undefined}>
          <button type="button" className="flex-1 rounded-xl px-2 text-lg disabled:opacity-30" disabled={phase !== "lesson" || i === 0} onClick={() => goTo(i - 1)} aria-label="Back">⏮</button>
          <button type="button" className="flex-1 rounded-xl px-2 text-lg" onClick={togglePlay} aria-label="Play or pause">{speech.speaking && !speech.paused ? "⏸" : "▶"}</button>
          <button type="button" className="flex-1 rounded-xl px-2 text-lg disabled:opacity-30" disabled={phase === "outro" || (phase === "lesson" && beat?.kind === "check" && !checkDone)} onClick={() => (phase === "intro" ? goTo(0) : goTo(i + 1))} aria-label="Next">⏭</button>
          <button type="button" className={`flex-1 rounded-xl px-2 text-lg ${hand ? "bg-accent/60" : ""}`} onClick={raiseHand} aria-label="Raise your hand">✋</button>
          <button type="button" className={`flex-1 rounded-xl px-2 text-lg ${pad ? "bg-accent/60" : ""}`} onClick={() => setPad((p) => !p)} aria-label="Scratchpad">✏️</button>
          <span className="px-2 text-[11px] font-bold text-white/70 tabular-nums">{progress}%</span>
        </div>
      </div>
    </>
  );

  return (
    <Classroom scene={c.rig.scene} camera={camera} overlay={overlay}>
      <div className="absolute inset-0 grid grid-rows-[42%_1fr] gap-2 px-3 pt-[calc(max(.5rem,env(safe-area-inset-top))+3.4rem)] pb-[calc(max(.5rem,env(safe-area-inset-bottom))+10rem)] landscape:grid-rows-1 landscape:grid-cols-[32%_1fr] landscape:pb-[calc(max(.5rem,env(safe-area-inset-bottom))+8.5rem)]">
        <div className="relative min-h-0 order-1 landscape:order-2">
          <Board show={phase === "lesson" && beat?.kind !== "check" ? beat?.show ?? null : null} idle={phase === "lesson" && beat?.kind !== "check" && !beat?.show} revealed={revealed} rtl={rtl} title={script.title} kindLabel={label}>{boardBody}</Board>
          <Scratchpad open={pad} onClose={() => setPad(false)} />
        </div>
        <div className="relative min-h-0 order-2 landscape:order-1 flex items-end justify-center landscape:justify-start landscape:ps-[4%]">
          <div className={`h-full ${walking ? "t-enter" : ""}`}>
            <Teacher c={c} gesture={gesture} mood={mood} viseme={speech.speaking && !speech.paused ? speech.viseme : "rest"} walking={walking} className="!h-full !w-auto max-w-full drop-shadow-[0_10px_18px_rgba(0,0,0,.35)]" />
          </div>
        </div>
      </div>
    </Classroom>
  );
}

export function FlagButton({ scriptId }: { scriptId: string }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p className="mt-1">Thanks. It will be rewritten with the strongest model next time.</p>;
  return <button type="button" disabled={pending} className="btn-ghost btn-sm mt-1" onClick={() => start(async () => { const { flagLessonAction } = await import("@/lib/actions/teach"); await flagLessonAction(scriptId); setDone(true); })}>🚩 Flag a wrong fact</button>;
}
