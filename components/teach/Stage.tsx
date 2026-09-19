"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Teacher } from "./Teacher";
import { Classroom } from "./Classroom";
import { Board } from "./Board";
import { Scratchpad } from "./Scratchpad";
import { Confetti } from "./Confetti";
import { VoicePicker } from "./VoicePicker";
import { isCloudVoice, useRecognition, useSpeech } from "./useSpeech";
import { useClips } from "./useClips";
import { askTeacherAction, finishLessonAction, recordBeatAction } from "@/lib/actions/teach";
import type { Character } from "@/lib/characters";
import type { LessonScript } from "@/lib/ai/lesson-script";
import type { CloudVoice } from "@/lib/tts";
import { beatLabel, cameraFor, gestureFor, moodFor, revealCount, sceneStep, wordsOf, boardLines, type Camera, type Gesture, type Mood } from "@/lib/teach/performance";
import { runAction } from "@/lib/client-action";
import { closingLine, correctLine, greetingLine, hintLine, revealLine } from "@/lib/teach/lines";

type Beat = LessonScript["beats"][number] & { image?: { url: string; credit?: string | null; license?: string | null } | null };
type Phase = "intro" | "lesson" | "outro";

const ADVANCE_MS = 1300;
const NO_CLOUD: CloudVoice[] = [];
const HOOK_RECAP = ["hook", "recap"];

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
export function Stage({ sessionId, scriptId, character, script, language, startBeat, minutes, demo = false, cloudVoices = NO_CLOUD, video = false, videoKinds = HOOK_RECAP, preferFemale, presenterUrl, upgrading = false }: { sessionId: string; scriptId: string; character: Character; script: LessonScript; language: "en" | "ar"; startBeat: number; minutes: number; demo?: boolean; cloudVoices?: CloudVoice[]; /** Presenter clips are on for this lesson (D-ID configured, premium voice available). */ video?: boolean; /** Which beat kinds get a clip. */ videoKinds?: string[]; /** The presenter's voice gender, when it differs from the character's. */ preferFemale?: boolean; /** The presenter's photo, shown until the first clip plays. */ presenterUrl?: string | null; /** Better pictures for this older lesson are being prepared in the background. */ upgrading?: boolean }) {
  const c = character;
  const rtl = language === "ar";
  const beats = script.beats;
  const total = beats.length;
  const videoRef = useRef<HTMLVideoElement>(null);
  const speech = useSpeech(language, c, cloudVoices, videoRef, preferFemale ?? !!c.voice.preferFemale);
  const [videoOn, setVideoOn] = useState(true);
  useEffect(() => { try { setVideoOn(localStorage.getItem("teach:video") !== "off"); } catch { /* ignore */ } }, []);
  const useVideo = video && !demo && videoOn;
  const clips = useClips({ enabled: useVideo, character: c.id, language, voice: isCloudVoice(speech.voiceId) ? speech.voiceId!.slice("cloud:".length) : null, kinds: videoKinds });
  const warmBeat = (k: number) => { const b = beats[k]; if (b) clips.warm(b.say, b.kind); };
  // Ask about every line once at the start: rendered clips play whatever the mode, and the allowed kinds start rendering.
  const greeting = greetingLine(c, language, script.title);
  const closing = closingLine(language);
  // The answers to a check are known from the script too, so they are asked for as well and the presenter keeps talking.
  const feedback = beats.flatMap((b) => b.check ? [
    { text: correctLine(c, language, b.check.explanation), kind: b.kind },
    { text: hintLine(c, language, b.check.hint), kind: b.kind },
    { text: revealLine(b.check.explanation, b.check.hint), kind: b.kind },
  ] : []);
  useEffect(() => { if (useVideo) clips.prime([{ text: greeting, kind: "hook" }, ...beats.map((b) => ({ text: b.say, kind: b.kind })), ...feedback, { text: closing, kind: "recap" }]); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useVideo, speech.voiceId]);
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
  const [layout, setLayout] = useState<"stage" | "board">("stage");
  useEffect(() => { try { const l = localStorage.getItem("teach:layout"); if (l === "board") setLayout("board"); } catch { /* ignore */ } }, []);
  const setLayoutKeep = (l: "stage" | "board") => { setLayout(l); try { localStorage.setItem("teach:layout", l); } catch { /* ignore */ } };
  // The phone's own picture-in-picture takes the presenter out of the page: give the board the room.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const enter = () => setLayout("board");
    const leave = () => { try { setLayout(localStorage.getItem("teach:layout") === "board" ? "board" : "stage"); } catch { setLayout("stage"); } };
    v.addEventListener("enterpictureinpicture", enter); v.addEventListener("leavepictureinpicture", leave);
    return () => { v.removeEventListener("enterpictureinpicture", enter); v.removeEventListener("leavepictureinpicture", leave); };
  }, []);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const autoRef = useRef(auto);
  const advanceRef = useRef<number | null>(null);
  const startedAt = useRef(Date.now());
  const correctCount = useRef(0);
  const beat: Beat | undefined = beats[i];

  useEffect(() => { autoRef.current = auto; }, [auto]);

  const speak = useCallback((text: string, onEnd?: () => void, videoUrl?: string | null) => { setLine(text); speech.say(text, onEnd, videoUrl); }, [speech]);
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
    let cancelled = false;
    const t1 = window.setTimeout(async () => {
      setWalking(false);
      setGestureOverride("wave");
      setMoodOverride("happy");
      const clip = useVideo ? clips.get(greeting) ?? await clips.wait(greeting, 2000) : null;
      if (cancelled) return;
      speak(greeting, () => { setGestureOverride(null); setMoodOverride(null); scheduleAdvance(-1); }, clip);
      if (beats[0]) { speech.prefetch(beats[0].say); warmBeat(0); }
      warmBeat(1);
    }, 1700);
    return () => { cancelled = true; window.clearTimeout(t1); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, started]);

  // Each beat: say it; afterwards wait at a check, else advance when on auto.
  useEffect(() => {
    if (phase !== "lesson" || !beat || !started) return;
    let cancelled = false;
    (async () => {
      let clip = useVideo ? clips.get(beat.say) : null;
      if (useVideo && !clip) { warmBeat(i); clip = await clips.wait(beat.say, 2000); }
      if (cancelled) return;
      speak(beat.say, () => { if (beat.kind !== "check") scheduleAdvance(i); }, clip);
    })();
    if (beats[i + 1]) speech.prefetch(beats[i + 1].say);
    warmBeat(i + 1); warmBeat(i + 2);
    return () => { cancelled = true; cancelAdvance(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, i, started]);

  // Outro: celebrate.
  useEffect(() => {
    if (phase !== "outro") return;
    setGestureOverride("celebrate"); setMoodOverride("happy"); setBurst((b) => b + 1);
    let cancelled = false;
    (async () => { const clip = useVideo ? clips.get(closing) ?? await clips.wait(closing, 2000) : null; if (!cancelled) speak(closing, undefined, clip); })();
    return () => { cancelled = true; };
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
      const line = correctLine(c, language, beat.check.explanation);
      speak(line, () => { setGestureOverride(null); setMoodOverride(null); scheduleAdvance(i); }, useVideo ? clips.get(line) : null);
      if (!demo) void recordBeatAction(sessionId, i, { correct: true, attempts: n });
    } else if (n >= 2) {
      setCheckDone(true); setGestureOverride("explain"); setMoodOverride("encourage");
      const line = revealLine(beat.check.explanation, beat.check.hint);
      speak(line, () => { setGestureOverride(null); setMoodOverride(null); scheduleAdvance(i); }, useVideo ? clips.get(line) : null);
      if (!demo) void recordBeatAction(sessionId, i, { correct: false, attempts: n });
    } else {
      setGestureOverride("oops"); setMoodOverride("sad");
      const line = hintLine(c, language, beat.check.hint);
      speak(line, () => { setGestureOverride("think"); setMoodOverride("think"); }, useVideo ? clips.get(line) : null);
    }
  }

  function togglePlay() {
    if (speech.paused) { speech.resume(); return; }
    if (speech.speaking) { cancelAdvance(); speech.pause(); return; }
    if (phase === "lesson" && beat) speak(beat.say, () => { if (beat.kind !== "check") scheduleAdvance(i); }, useVideo ? clips.get(beat.say) : null);
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
  const camera: Camera = layout === "board" ? "wide" : hand ? "teacher" : phase === "lesson" && beat && speech.speaking ? cameraFor(beat) : "wide";
  const lines = beat?.show ? boardLines(beat.show).length : 0;
  const revealed = phase !== "lesson" ? 0 : speech.speaking ? revealCount(lines, speech.wordIndex / Math.max(1, speech.wordCount - 1)) : lines;
  const step = phase === "lesson" && beat?.show?.type === "scene" ? sceneStep(beat.say, beat.show.cues, speech.wordIndex, !speech.speaking) : 99;
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
      {voiceOpen && <VoicePicker voices={speech.voices} cloudVoices={cloudVoices} current={speech.voiceId} language={language} onPick={(u) => { speech.setVoice(u); speech.preview(u, rtl ? c.lines.hello_ar : c.lines.hello); }} onPreview={(u) => speech.preview(u, rtl ? c.lines.hello_ar : c.lines.hello)} onClose={() => setVoiceOpen(false)} />}
      {!started && (
        <button type="button" onClick={() => { speech.unlock(); setStarted(true); }} className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-[2px] text-white" dir={rtl ? "rtl" : undefined}>
          <span className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-white text-[#2b1d2e] text-4xl shadow-2xl pulse">▶</span>
          <span className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{rtl ? "اضغط لبدء الدرس" : "Tap to start the lesson"}</span>
          <span className="text-sm text-white/80">{c.name} · {script.title}</span>
          <span className="text-xs text-white/60">{rtl ? "ارفع الصوت 🔊 · يمكنك تغيير صوت المعلم من زر 🔊" : "Turn the sound up 🔊 · change the teacher's voice with the 🔊 button"}</span>
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
        {upgrading && <span className="shrink-0 rounded-full bg-[#ffd166]/90 px-2 py-1 text-[10px] font-bold text-[#2b1d2e]" title={rtl ? "صور أفضل لهذا الدرس تُجهَّز الآن؛ أعد فتحه بعد دقيقتين" : "Better pictures for this lesson are being prepared; reopen it in two minutes"}>✨ {rtl ? "صور قادمة" : "pictures coming"}</span>}
        {video && !demo && (
          <button type="button" onClick={() => { const next = !videoOn; setVideoOn(next); try { localStorage.setItem("teach:video", next ? "on" : "off"); } catch { /* ignore */ } }} className={`shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-bold backdrop-blur ${videoOn ? "bg-accent/80 text-white" : "bg-black/40 text-white/70"}`} title={rtl ? "المعلم بالفيديو أو الرسوم" : "Human presenter on video, or the animated teacher"}>
            🎬 {videoOn ? (phase === "lesson" && beat && videoKinds.includes(beat.kind) && speech.speaking && !speech.videoPlaying ? (rtl ? "يُجهَّز" : "preparing") : (rtl ? "فيديو" : "Video")) : (rtl ? "رسوم" : "Cartoon")}
          </button>
        )}
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
          <button type="button" className={`flex-1 rounded-xl px-2 text-lg ${layout === "board" ? "bg-accent/60" : ""}`} onClick={() => setLayoutKeep(layout === "board" ? "stage" : "board")} aria-label="Board size" title={rtl ? "سبورة كبيرة والمعلم في الزاوية" : "Big board, teacher in the corner"}>⛶</button>
          <button type="button" className={`flex-1 rounded-xl px-2 text-lg ${voiceOpen ? "bg-accent/60" : ""}`} onClick={() => { cancelAdvance(); speech.stop(); setVoiceOpen((v) => !v); }} aria-label="Teacher's voice">🔊</button>
          <span className="px-2 text-[11px] font-bold text-white/70 tabular-nums">{progress}%</span>
        </div>
      </div>
    </>
  );

  return (
    <Classroom scene={c.rig.scene} camera={camera} overlay={overlay}>
      <div className={`absolute inset-0 grid gap-2 px-3 pt-[calc(max(.5rem,env(safe-area-inset-top))+3.4rem)] pb-[calc(max(.5rem,env(safe-area-inset-bottom))+10rem)] landscape:pb-[calc(max(.5rem,env(safe-area-inset-bottom))+8.5rem)] ${layout === "board" ? "grid-rows-1 grid-cols-1" : "grid-rows-[42%_1fr] landscape:grid-rows-1 landscape:grid-cols-[32%_1fr]"}`}>
        <div className="relative min-h-0 order-1 landscape:order-2">
          <Board show={phase === "lesson" && beat?.kind !== "check" ? beat?.show ?? null : null} idle={phase === "lesson" && beat?.kind !== "check" && !beat?.show} revealed={revealed} step={step} rtl={rtl} title={script.title} kindLabel={label} image={phase === "lesson" && beat?.kind !== "check" ? beat?.image ?? null : null}>{boardBody}</Board>
          <Scratchpad open={pad} onClose={() => setPad(false)} />
        </div>
        <div className={layout === "board" ? "absolute z-10 start-4 bottom-[calc(max(.5rem,env(safe-area-inset-bottom))+10.5rem)] landscape:bottom-[calc(max(.5rem,env(safe-area-inset-bottom))+9rem)] h-[26%] landscape:h-[38%] flex items-end" : "relative min-h-0 order-2 landscape:order-1 flex items-end justify-center landscape:justify-start landscape:ps-[4%]"}>
          {!useVideo && (
            <div className={`h-full ${walking ? "t-enter" : ""}`}>
              <Teacher c={c} gesture={gesture} mood={mood} viseme={speech.speaking && !speech.paused ? speech.viseme : "rest"} walking={walking} className="!h-full !w-auto max-w-full drop-shadow-[0_10px_18px_rgba(0,0,0,.35)]" />
            </div>
          )}
          <div className={`presenter-frame relative h-full aspect-[3/4] max-w-full flex items-end justify-center ${useVideo ? "" : "absolute inset-0 opacity-0 pointer-events-none"} ${useVideo && !speech.videoPlaying ? (speech.speaking && !speech.paused ? "presenter-talking" : "presenter-still") : ""}`}>
            <video ref={videoRef} playsInline preload="auto" poster={presenterUrl ?? undefined} className="h-full w-full rounded-[1.4rem] object-cover shadow-[0_18px_40px_rgba(0,0,0,.4)] ring-4 ring-white/15 bg-black/20" />
            {useVideo && speech.speaking && !speech.paused && !speech.videoPlaying && <span className="speaking-bars" aria-hidden><i /><i /><i /><i /></span>}
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
