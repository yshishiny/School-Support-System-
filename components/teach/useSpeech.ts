"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Character } from "@/lib/characters";
import { estimateSeconds, visemeFor, wordIndexAt, wordsOf, type Viseme } from "@/lib/teach/performance";

export interface SpeechState {
  speaking: boolean;
  paused: boolean;
  available: boolean;
  /** The browser refused to speak without a tap (autoplay policy); the next tap on play will fix it. */
  blocked: boolean;
  /** Index of the word being said, for karaoke captions and the board reveal. */
  wordIndex: number;
  wordCount: number;
  viseme: Viseme;
}

/**
 * Browser speech with timing: word boundaries drive the captions and the mouth; where the browser gives no
 * boundaries (many Android voices) the position is estimated from elapsed time; with no voice at all the line
 * still "plays" silently so the lesson keeps its rhythm. Chrome's 15-second cut-off is worked around.
 */
export function useSpeech(language: "en" | "ar", c: Character) {
  const [state, setState] = useState<SpeechState>({ speaking: false, paused: false, available: true, blocked: false, wordIndex: 0, wordCount: 0, viseme: "rest" });
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const wordsRef = useRef<string[]>([]);
  const wordRef = useRef(0);
  const boundaryRef = useRef(false);
  const startedRef = useRef(0);
  const estRef = useRef(1);
  const tickRef = useRef<number | null>(null);
  const keepRef = useRef<number | null>(null);
  const silentRef = useRef<number | null>(null);
  const endRef = useRef<(() => void) | null>(null);
  const activeRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceId, setVoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) { setState((s) => ({ ...s, available: false })); return; }
    const pick = () => {
      const all = window.speechSynthesis.getVoices();
      const lang = language === "ar" ? "ar" : "en";
      const cands = all.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(lang));
      let stored: string | null = null;
      try { stored = localStorage.getItem(storageKey(language)); } catch { /* private mode */ }
      const byGender = c.voice.preferFemale ? cands.find((v) => /female|zira|samantha|salma|hoda|laila|aria|jenny|amira/i.test(v.name)) : cands.find((v) => /male|david|daniel|naayf|hamed|guy|ryan|shakir|tarik/i.test(v.name));
      const chosen = cands.find((v) => v.voiceURI === stored)
        ?? (lang === "ar" ? cands.find((v) => /eg/i.test(v.lang) || /egypt|مصر/i.test(v.name)) : undefined)
        ?? byGender ?? cands.find((v) => v.localService) ?? cands[0] ?? null;
      voiceRef.current = chosen;
      setVoices(cands);
      setVoiceId(chosen?.voiceURI ?? null);
      if (all.length) setState((s) => ({ ...s, available: true }));
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [language, c]);

  /** The child's pick for this language on this device (voices are installed per phone, so the choice lives here). */
  const setVoice = useCallback((uri: string) => {
    const v = voices.find((x) => x.voiceURI === uri) ?? null;
    voiceRef.current = v;
    setVoiceId(v?.voiceURI ?? null);
    try { if (v) localStorage.setItem(storageKey(language), v.voiceURI); } catch { /* ignore */ }
  }, [voices, language]);

  /** A short sample in a given voice, without touching the lesson's line. */
  const preview = useCallback((uri: string, text: string) => {
    if (!("speechSynthesis" in window)) return;
    const v = voices.find((x) => x.voiceURI === uri);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language === "ar" ? "ar-EG" : "en-US";
    if (v) u.voice = v;
    u.rate = c.voice.rate; u.pitch = c.voice.pitch;
    window.setTimeout(() => window.speechSynthesis.speak(u), 60);
  }, [voices, language, c]);

  const clearTimers = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (keepRef.current) window.clearInterval(keepRef.current);
    if (silentRef.current) window.clearTimeout(silentRef.current);
    tickRef.current = keepRef.current = silentRef.current = null;
  };

  const finish = useCallback(() => {
    clearTimers();
    activeRef.current = null;
    setState((s) => ({ ...s, speaking: false, paused: false, viseme: "rest", wordIndex: Math.max(0, s.wordCount - 1) }));
    const cb = endRef.current;
    endRef.current = null;
    cb?.();
  }, []);

  const stop = useCallback(() => {
    endRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    clearTimers();
    activeRef.current = null;
    setState((s) => ({ ...s, speaking: false, paused: false, viseme: "rest" }));
  }, []);

  const say = useCallback((text: string, onEnd?: () => void) => {
    stop();
    const words = wordsOf(text);
    wordsRef.current = words;
    wordRef.current = 0;
    boundaryRef.current = false;
    startedRef.current = Date.now();
    estRef.current = estimateSeconds(text, c.voice.rate) * 1000;
    endRef.current = onEnd ?? null;
    setState((s) => ({ ...s, speaking: true, paused: false, wordIndex: 0, wordCount: words.length, viseme: "small" }));
    let tick = 0;
    tickRef.current = window.setInterval(() => {
      tick += 1;
      if (!boundaryRef.current) {
        const f = Math.min(1, (Date.now() - startedRef.current) / estRef.current);
        wordRef.current = Math.min(words.length - 1, Math.floor(f * words.length));
      }
      const w = words[wordRef.current] ?? "";
      setState((s) => (s.paused ? s : { ...s, wordIndex: wordRef.current, viseme: visemeFor(w, tick) }));
    }, 85);

    const hasVoice = typeof window !== "undefined" && "speechSynthesis" in window;
    if (!hasVoice) {
      silentRef.current = window.setTimeout(finish, estRef.current);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language === "ar" ? "ar-EG" : "en-US";
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = c.voice.rate;
    u.pitch = c.voice.pitch;
    u.onboundary = (e) => {
      if (e.name && e.name !== "word") return;
      boundaryRef.current = true;
      wordRef.current = wordIndexAt(text, e.charIndex);
    };
    u.onend = () => { if (activeRef.current === u) finish(); };
    // No usable voice (none installed, language missing, audio blocked): keep the line's rhythm silently.
    u.onerror = (e) => {
      if (activeRef.current !== u || e.error === "interrupted" || e.error === "canceled") return;
      if (e.error === "not-allowed") setState((s) => ({ ...s, blocked: true }));
      else setState((s) => ({ ...s, available: false }));
      if (keepRef.current) window.clearInterval(keepRef.current);
      if (silentRef.current) window.clearTimeout(silentRef.current);
      silentRef.current = window.setTimeout(finish, Math.max(300, estRef.current - (Date.now() - startedRef.current)));
    };
    activeRef.current = u;
    // Android drops an utterance queued in the same tick as a cancel(); give it a moment.
    window.setTimeout(() => { if (activeRef.current === u) window.speechSynthesis.speak(u); }, 60);
    u.onstart = () => { if (activeRef.current === u) setState((s) => ({ ...s, blocked: false, available: true })); };
    // Desktop Chrome stops long utterances after ~15 s unless nudged; a pause/resume keeps it going. Phones and Safari break on it.
    if (/chrome/i.test(navigator.userAgent) && !/android|mobile|iphone|ipad|edg\//i.test(navigator.userAgent)) {
      keepRef.current = window.setInterval(() => { if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) { window.speechSynthesis.pause(); window.speechSynthesis.resume(); } }, 9000);
    }
    // Safety net: if the browser never fires onend (it happens), close the line after the estimate plus margin.
    silentRef.current = window.setTimeout(() => { if (activeRef.current === u && !window.speechSynthesis.speaking) finish(); }, estRef.current * 1.8 + 3000);
  }, [c, language, stop, finish]);

  const pause = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.pause();
    setState((s) => ({ ...s, paused: true, viseme: "rest" }));
  }, []);
  const resume = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.resume();
    startedRef.current = Date.now() - (wordRef.current / Math.max(1, wordsRef.current.length)) * estRef.current;
    setState((s) => ({ ...s, paused: false }));
  }, []);

  /** Call inside a tap: browsers only allow speech after a user gesture, and iOS needs one real speak() to open the channel. */
  const unlock = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    u.rate = 2;
    window.speechSynthesis.speak(u);
    setState((s) => ({ ...s, blocked: false }));
  }, []);

  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); clearTimers(); }, []);

  return { ...state, say, stop, pause, resume, unlock, voices, voiceId, setVoice, preview };
}

function storageKey(language: "en" | "ar") { return `teach:voice:${language}`; }

/** "Microsoft Hoda - Arabic (Egypt)" → a short label and a flag for the list. */
export function voiceLabel(v: SpeechSynthesisVoice): { name: string; region: string; egyptian: boolean } {
  const lang = v.lang.replace("_", "-");
  const region = lang.split("-")[1]?.toUpperCase() ?? "";
  const egyptian = region === "EG" || /egypt|مصر/i.test(v.name);
  const name = v.name.replace(/Microsoft |Google |Apple |Samsung |\(.*?\)|- .*$/g, "").trim() || v.name;
  return { name, region, egyptian };
}

type RecognitionCtor = new () => { lang: string; interimResults: boolean; maxAlternatives: number; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };

/** The microphone for "raise your hand": Chrome and Android have it, iOS Safari partly; typing is the fallback. */
export function useRecognition(language: "en" | "ar") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<InstanceType<RecognitionCtor> | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  const start = useCallback((onResult: (text: string) => void) => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = language === "ar" ? "ar-EG" : "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => { const t = e.results[0]?.[0]?.transcript ?? ""; if (t) onResult(t); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    setListening(true);
    r.start();
  }, [language]);
  const stop = useCallback(() => { recRef.current?.stop(); setListening(false); }, []);
  return { supported, listening, start, stop };
}
