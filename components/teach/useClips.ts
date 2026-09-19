"use client";

import { useCallback, useEffect, useRef } from "react";

type Answer = { status: "done"; url: string } | { status: "pending" } | { status: "off" } | { status: "error" };

/**
 * Presenter clips for the lesson's lines. `prime` asks about every line once (rendering only the kinds allowed),
 * `warm` asks for one line and keeps asking every few seconds while it renders, `get` answers at once from what is
 * known, and `wait` gives an in-flight answer a moment to arrive before the line falls back to the animated teacher.
 */
export function useClips(o: { enabled: boolean; character: string; language: "en" | "ar"; voice: string | null; kinds: string[] }) {
  const ready = useRef<Map<string, string>>(new Map());
  const dead = useRef<Set<string>>(new Set());
  const inflight = useRef<Map<string, Promise<Answer>>>(new Map());
  const timers = useRef<Map<string, number>>(new Map());
  const { enabled, character, language, voice, kinds } = o;

  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach((id) => window.clearTimeout(id)); t.clear(); };
  }, []);

  const ask = useCallback((text: string, kind: string, create: boolean): Promise<Answer> => {
    const hit = inflight.current.get(text);
    if (hit) return hit;
    const p = (async (): Promise<Answer> => {
      try {
        const res = await fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, character, language, voice, create, kind }) });
        if (!res.ok) return { status: "off" };
        const a = (await res.json()) as Answer;
        if (a.status === "done") ready.current.set(text, a.url);
        else if (create && (a.status === "error" || a.status === "off")) dead.current.add(text);
        return a;
      } catch { return { status: "off" }; } finally { inflight.current.delete(text); }
    })();
    inflight.current.set(text, p);
    return p;
  }, [character, language, voice]);

  const warm = useCallback((text: string, kind: string, attempt = 0) => {
    if (!enabled || !text || ready.current.has(text) || dead.current.has(text) || timers.current.has(text)) return;
    const create = kinds.includes(kind);
    void ask(text, kind, create).then((a) => {
      if (a.status === "pending" && attempt < 30) {
        const id = window.setTimeout(() => { timers.current.delete(text); warm(text, kind, attempt + 1); }, 5000);
        timers.current.set(text, id);
      }
    });
  }, [enabled, kinds, ask]);

  /** Every line of the lesson at once: renders the allowed kinds, only asks about the rest. */
  const prime = useCallback((lines: { text: string; kind: string }[]) => { lines.forEach((l) => warm(l.text, l.kind)); }, [warm]);

  const get = useCallback((text: string): string | null => ready.current.get(text) ?? null, []);

  const wait = useCallback(async (text: string, ms: number): Promise<string | null> => {
    const known = ready.current.get(text);
    if (known) return known;
    const p = inflight.current.get(text);
    if (!p) return null;
    const timeout = new Promise<null>((r) => window.setTimeout(() => r(null), ms));
    await Promise.race([p, timeout]);
    return ready.current.get(text) ?? null;
  }, []);

  return { warm, prime, get, wait };
}
