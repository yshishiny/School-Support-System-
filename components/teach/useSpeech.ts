"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Character } from "@/lib/characters";
import type { CloudVoice } from "@/lib/tts";
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

const CLOUD = "cloud:";
export const isCloudVoice = (id: string | null | undefined) => !!id && id.startsWith(CLOUD);

/**
 * The teacher's voice, two ways: a premium cloud voice (MP3 from /api/tts, cached, prefetched a line ahead)
 * or the browser's own speech. Word timing drives the captions and the mouth: from audio progress for the
 * cloud, from word boundaries where the browser reports them, else from elapsed time. With no voice at all
 * the line still "plays" silently so the lesson keeps its rhythm. Chrome's 15-second cut-off is worked around.
 */
export function useSpeech(language: "en" | "ar", c: Character, cloudVoices: CloudVoice[] = [], videoRef?: React.RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<SpeechState>({ speaking: false, paused: false, available: true, blocked: false, wordIndex: 0, wordCount: 0, viseme: "rest" });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const voiceIdRef = useRef<string | null>(null);
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tokenRef = useRef(0);
  const cacheRef = useRef<Map<string, Promise<string>>>(new Map());
  const modeRef = useRef<"browser" | "cloud" | "video">("browser");
  const [videoPlaying, setVideoPlaying] = useState(false);

  useEffect(() => { voiceIdRef.current = voiceId; }, [voiceId]);

  useEffect(() => {
    const hasBrowser = typeof window !== "undefined" && "speechSynthesis" in window;
    let stored: string | null = null;
    try { stored = localStorage.getItem(storageKey(language)); } catch { /* private mode */ }
    const cloudDefault = cloudVoices.find((v) => v.gender === (c.voice.preferFemale ? "f" : "m")) ?? cloudVoices[0] ?? null;
    const storedCloud = stored && isCloudVoice(stored) && cloudVoices.some((v) => CLOUD + v.id === stored) ? stored : null;
    const pick = () => {
      const all = hasBrowser ? window.speechSynthesis.getVoices() : [];
      const lang = language === "ar" ? "ar" : "en";
      const cands = all.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(lang));
      const byGender = c.voice.preferFemale ? cands.find((v) => /female|zira|samantha|salma|hoda|laila|aria|jenny|amira/i.test(v.name)) : cands.find((v) => /male|david|daniel|naayf|hamed|guy|ryan|shakir|tarik/i.test(v.name));
      const browserPick = cands.find((v) => v.voiceURI === stored)
        ?? (lang === "ar" ? cands.find((v) => /eg/i.test(v.lang) || /egypt|مصر/i.test(v.name)) : undefined)
        ?? byGender ?? cands.find((v) => v.localService) ?? cands[0] ?? null;
      voiceRef.current = browserPick;
      setVoices(cands);
      const useCloud = storedCloud ?? (stored && cands.some((v) => v.voiceURI === stored) ? null : cloudDefault ? CLOUD + cloudDefault.id : null);
      setVoiceId(useCloud ?? browserPick?.voiceURI ?? null);
      if (all.length || cloudVoices.length) setState((s) => ({ ...s, available: true }));
      else if (!hasBrowser) setState((s) => ({ ...s, available: false }));
    };
    pick();
    if (hasBrowser) window.speechSynthesis.onvoiceschanged = pick;
    return () => { if (hasBrowser) window.speechSynthesis.onvoiceschanged = null; };
  }, [language, c, cloudVoices]);

  const audio = () => {
    if (!audioRef.current) { audioRef.current = new Audio(); audioRef.current.preload = "auto"; }
    return audioRef.current;
  };

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
    tokenRef.current += 1;
    endRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    const a = audioRef.current;
    if (a) { a.onended = null; a.ontimeupdate = null; a.onerror = null; a.pause(); }
    const v = videoRef?.current;
    if (v) { v.onended = null; v.ontimeupdate = null; v.onerror = null; v.pause(); }
    setVideoPlaying(false);
    clearTimers();
    activeRef.current = null;
    setState((s) => ({ ...s, speaking: false, paused: false, viseme: "rest" }));
  }, [videoRef]);

  /** MP3 for a line in the current cloud voice, from the local cache or the server. */
  const fetchAudio = useCallback((text: string, cloudId: string): Promise<string> => {
    const key = `${cloudId}|${text}`;
    const hit = cacheRef.current.get(key);
    if (hit) return hit;
    const p = (async () => {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice: cloudId, rate: c.voice.rate, pitch: c.voice.pitch }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "voice" }))).error ?? "voice");
      return URL.createObjectURL(await res.blob());
    })();
    p.catch(() => cacheRef.current.delete(key));
    if (cacheRef.current.size > 60) { const first = cacheRef.current.keys().next().value; if (first) cacheRef.current.delete(first); }
    cacheRef.current.set(key, p);
    return p;
  }, [c]);

  const startTicker = (words: string[]) => {
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
  };

  const sayBrowser = useCallback((text: string, words: string[]) => {
    const hasVoice = typeof window !== "undefined" && "speechSynthesis" in window;
    if (!hasVoice) { silentRef.current = window.setTimeout(finish, estRef.current); return; }
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
    u.onstart = () => { if (activeRef.current === u) setState((s) => ({ ...s, blocked: false, available: true })); };
    activeRef.current = u;
    // Android drops an utterance queued in the same tick as a cancel(); give it a moment.
    window.setTimeout(() => { if (activeRef.current === u) window.speechSynthesis.speak(u); }, 60);
    // Desktop Chrome stops long utterances after ~15 s unless nudged; a pause/resume keeps it going. Phones and Safari break on it.
    if (/chrome/i.test(navigator.userAgent) && !/android|mobile|iphone|ipad|edg\//i.test(navigator.userAgent)) {
      keepRef.current = window.setInterval(() => { if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) { window.speechSynthesis.pause(); window.speechSynthesis.resume(); } }, 9000);
    }
    // Safety net: if the browser never fires onend (it happens), close the line after the estimate plus margin.
    silentRef.current = window.setTimeout(() => { if (activeRef.current === u && !window.speechSynthesis.speaking) finish(); }, estRef.current * 1.8 + 3000);
    void words;
  }, [c, language, finish]);

  const sayCloud = useCallback(async (text: string, words: string[], cloudId: string, token: number) => {
    const a = audio();
    try {
      const url = await fetchAudio(text, cloudId);
      if (tokenRef.current !== token) return;
      boundaryRef.current = true;
      a.src = url;
      a.playbackRate = 1;
      a.ontimeupdate = () => { if (a.duration > 0) wordRef.current = Math.min(words.length - 1, Math.floor((a.currentTime / a.duration) * words.length)); };
      a.onended = () => { if (tokenRef.current === token) finish(); };
      a.onerror = () => { if (tokenRef.current === token) { boundaryRef.current = false; startedRef.current = Date.now(); sayBrowser(text, words); } };
      await a.play();
      setState((s) => ({ ...s, blocked: false, available: true }));
    } catch (err) {
      if (tokenRef.current !== token) return;
      const blocked = err instanceof Error && /NotAllowed/i.test(err.name);
      if (blocked) { setState((s) => ({ ...s, blocked: true })); silentRef.current = window.setTimeout(finish, Math.max(300, estRef.current - (Date.now() - startedRef.current))); return; }
      // Server or network trouble: the phone's voice takes over for this line.
      boundaryRef.current = false; startedRef.current = Date.now();
      sayBrowser(text, words);
    }
  }, [fetchAudio, finish, sayBrowser]);

  /** The line as a presenter clip: the video carries the voice; captions follow its progress. */
  const sayVideo = useCallback(async (text: string, words: string[], url: string, token: number) => {
    const v = videoRef?.current;
    if (!v) { sayBrowser(text, words); return; }
    const fallback = () => { if (tokenRef.current !== token) return; setVideoPlaying(false); modeRef.current = "cloud"; boundaryRef.current = false; startedRef.current = Date.now(); const id = voiceIdRef.current; if (isCloudVoice(id)) void sayCloud(text, words, id!.slice(CLOUD.length), token); else sayBrowser(text, words); };
    try {
      boundaryRef.current = true;
      v.src = url;
      v.ontimeupdate = () => { if (v.duration > 0) wordRef.current = Math.min(words.length - 1, Math.floor((v.currentTime / v.duration) * words.length)); };
      v.onended = () => { if (tokenRef.current === token) { setVideoPlaying(false); finish(); } };
      v.onerror = fallback;
      await v.play();
      if (tokenRef.current !== token) return;
      setVideoPlaying(true);
      setState((s) => ({ ...s, blocked: false, available: true }));
    } catch (err) {
      if (tokenRef.current !== token) return;
      if (err instanceof Error && /NotAllowed/i.test(err.name)) { setState((s) => ({ ...s, blocked: true })); silentRef.current = window.setTimeout(finish, Math.max(300, estRef.current - (Date.now() - startedRef.current))); return; }
      fallback();
    }
  }, [videoRef, finish, sayBrowser, sayCloud]);

  const say = useCallback((text: string, onEnd?: () => void, videoUrl?: string | null) => {
    stop();
    const token = tokenRef.current;
    const words = wordsOf(text);
    wordsRef.current = words;
    wordRef.current = 0;
    boundaryRef.current = false;
    startedRef.current = Date.now();
    estRef.current = estimateSeconds(text, c.voice.rate) * 1000;
    endRef.current = onEnd ?? null;
    setState((s) => ({ ...s, speaking: true, paused: false, wordIndex: 0, wordCount: words.length, viseme: "small" }));
    startTicker(words);
    const id = voiceIdRef.current;
    if (videoUrl && videoRef?.current) { modeRef.current = "video"; void sayVideo(text, words, videoUrl, token); }
    else if (isCloudVoice(id)) { modeRef.current = "cloud"; void sayCloud(text, words, id!.slice(CLOUD.length), token); }
    else { modeRef.current = "browser"; sayBrowser(text, words); }
  }, [c, stop, sayCloud, sayBrowser, sayVideo, videoRef]);

  /** Warm the cache for the next line so it plays with no gap. */
  const prefetch = useCallback((text: string) => {
    const id = voiceIdRef.current;
    if (isCloudVoice(id) && text) fetchAudio(text, id!.slice(CLOUD.length)).catch(() => null);
  }, [fetchAudio]);

  const pause = useCallback(() => {
    if (modeRef.current === "video") videoRef?.current?.pause();
    else if (modeRef.current === "cloud") audioRef.current?.pause();
    else if ("speechSynthesis" in window) window.speechSynthesis.pause();
    setState((s) => ({ ...s, paused: true, viseme: "rest" }));
  }, [videoRef]);
  const resume = useCallback(() => {
    if (modeRef.current === "video") void videoRef?.current?.play().catch(() => null);
    else if (modeRef.current === "cloud") void audioRef.current?.play().catch(() => null);
    else if ("speechSynthesis" in window) window.speechSynthesis.resume();
    startedRef.current = Date.now() - (wordRef.current / Math.max(1, wordsRef.current.length)) * estRef.current;
    setState((s) => ({ ...s, paused: false }));
  }, [videoRef]);

  /** The child's pick for this language on this device (voices are installed per phone, so the choice lives here). */
  const setVoice = useCallback((id: string) => {
    if (!isCloudVoice(id)) voiceRef.current = voices.find((x) => x.voiceURI === id) ?? null;
    setVoiceId(id);
    try { localStorage.setItem(storageKey(language), id); } catch { /* ignore */ }
  }, [voices, language]);

  /** A short sample in a given voice, without touching the lesson's line. */
  const preview = useCallback((id: string, text: string) => {
    stop();
    if (isCloudVoice(id)) {
      const token = tokenRef.current;
      fetchAudio(text, id.slice(CLOUD.length)).then((url) => { if (tokenRef.current !== token) return; const a = audio(); a.src = url; void a.play().catch(() => null); }).catch(() => null);
      return;
    }
    if (!("speechSynthesis" in window)) return;
    const v = voices.find((x) => x.voiceURI === id);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language === "ar" ? "ar-EG" : "en-US";
    if (v) u.voice = v;
    u.rate = c.voice.rate; u.pitch = c.voice.pitch;
    window.setTimeout(() => window.speechSynthesis.speak(u), 60);
  }, [voices, language, c, stop, fetchAudio]);

  /** Call inside a tap: browsers only allow sound after a user gesture, and iOS needs one real play per element. */
  const unlock = useCallback(() => {
    if (typeof window === "undefined") return;
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0; u.rate = 2;
      window.speechSynthesis.speak(u);
    }
    const a = audio();
    a.src = silentWav();
    void a.play().catch(() => null);
    const v = videoRef?.current;
    if (v) { v.src = silentWav(); void v.play().catch(() => null); }
    setState((s) => ({ ...s, blocked: false }));
  }, [videoRef]);

  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); audioRef.current?.pause(); clearTimers(); }, []);

  return { ...state, say, stop, pause, resume, unlock, prefetch, voices, voiceId, setVoice, preview, cloudVoices, videoPlaying };
}

function storageKey(language: "en" | "ar") { return `teach:voice:${language}`; }

/** A 50 ms silent WAV as a data URL, to open the audio element inside a tap. */
function silentWav(): string {
  const rate = 8000, n = 400;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  let bin = "";
  new Uint8Array(buf).forEach((b) => { bin += String.fromCharCode(b); });
  return `data:audio/wav;base64,${btoa(bin)}`;
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

/** "Microsoft Hoda - Arabic (Egypt)" → a short label and a flag for the list. */
export function voiceLabel(v: SpeechSynthesisVoice): { name: string; region: string; egyptian: boolean } {
  const lang = v.lang.replace("_", "-");
  const region = lang.split("-")[1]?.toUpperCase() ?? "";
  const egyptian = region === "EG" || /egypt|مصر/i.test(v.name);
  const name = v.name.replace(/Microsoft |Google |Apple |Samsung |\(.*?\)|- .*$/g, "").trim() || v.name;
  return { name, region, egyptian };
}
