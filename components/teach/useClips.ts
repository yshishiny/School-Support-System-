"use client";

import { useCallback, useEffect, useRef } from "react";

type Answer = { status: "done"; url: string } | { status: "pending" } | { status: "off" } | { status: "error" };

/**
 * Presenter clips for the lesson's lines. `get` answers at once from what is known; `warm` asks the server and,
 * while a clip renders, keeps asking every few seconds so it is ready by the time the line comes round again.
 */
export function useClips(o: { enabled: boolean; character: string; language: "en" | "ar"; voice: string | null }) {
  const ready = useRef<Map<string, string>>(new Map());
  const off = useRef<Set<string>>(new Set());
  const polling = useRef<Map<string, number>>(new Map());
  const { enabled, character, language, voice } = o;

  useEffect(() => {
    const timers = polling.current;
    return () => { timers.forEach((t) => window.clearTimeout(t)); timers.clear(); };
  }, []);

  const ask = useCallback(async (text: string, kind: string, create: boolean): Promise<Answer> => {
    const res = await fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, character, language, voice, create, kind }) });
    if (!res.ok) return { status: "off" };
    return (await res.json()) as Answer;
  }, [character, language, voice]);

  const warm = useCallback((text: string, kind: string, attempt = 0) => {
    if (!enabled || !text || ready.current.has(text) || off.current.has(text) || polling.current.has(text)) return;
    polling.current.set(text, 0);
    ask(text, kind, attempt === 0).then((a) => {
      polling.current.delete(text);
      if (a.status === "done") { ready.current.set(text, a.url); return; }
      if (a.status === "pending" && attempt < 30) { const t = window.setTimeout(() => { polling.current.delete(text); warm(text, kind, attempt + 1); }, 5000); polling.current.set(text, t); return; }
      off.current.add(text);
    }).catch(() => { polling.current.delete(text); });
  }, [enabled, ask]);

  const get = useCallback((text: string): string | null => ready.current.get(text) ?? null, []);

  return { warm, get };
}
