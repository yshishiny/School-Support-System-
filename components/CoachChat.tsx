"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clearCoachChatAction, coachChatAction, type ChatReply } from "@/lib/actions/wellbeing";

interface Msg {
  role: "user" | "assistant";
  content: string;
  helplines?: { name: string; number: string }[];
}

export function CoachChat({ initial, firstName, mascot }: { initial: Msg[]; firstName: string; mascot: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [msgs.length, pending]);

  function send() {
    const t = text.trim();
    if (!t || pending) return;
    setText("");
    setError(null);
    setMsgs((m) => [...m, { role: "user", content: t }]);
    start(async () => {
      try {
        const r: ChatReply = await coachChatAction(t);
        if (r.error) setError(r.error);
        else setMsgs((m) => [...m, { role: "assistant", content: r.reply, helplines: r.helplines }]);
      } catch (err) {
        setError(`Could not send (${err instanceof Error ? err.message : String(err)}). Reload and try again.`);
      }
    });
  }

  return (
    <div className="card p-0 overflow-hidden flex flex-col" style={{ minHeight: "60dvh" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b-2 border-line">
        <div className="flex items-center gap-2"><span className="text-2xl sticker-still">{mascot}</span><span className="font-bold" style={{ fontFamily: "var(--font-display)" }}>Coach</span></div>
        {msgs.length > 0 && (
          <form action={clearCoachChatAction} onSubmit={() => setMsgs([])}><button className="text-xs muted hover:text-bad">Clear chat</button></form>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {msgs.length === 0 && (
          <div className="rounded-2xl bg-panel-2 p-3 text-sm space-y-1">
            <p><b>Hey {firstName}.</b> This is your space. Stressed, bored, annoyed with a teacher, worried about something at home, or just want to talk about football: type it.</p>
            <p className="muted text-xs">What you write here stays between you and me. The only exception is if I think you are in danger. Then I tell your parents so someone is with you, and I tell you that I am doing it.</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-accent text-white rounded-br-md" : "bg-panel-2 rounded-bl-md"}`}>
              {m.content}
              {m.helplines && (
                <div className="mt-2 rounded-xl border border-warn/50 bg-warn/10 p-2 text-xs space-y-0.5">
                  <div className="font-bold">If you need someone right now:</div>
                  {m.helplines.map((h) => (
                    <div key={h.number}>{h.name}: <a href={`tel:${h.number}`} className="font-bold underline">{h.number}</a></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && <div className="flex justify-start"><div className="rounded-2xl bg-panel-2 px-3.5 py-2 text-sm muted">typing…</div></div>}
        {error && <p className="text-xs text-bad">{error}</p>}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 p-2 border-t-2 border-line"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input className="input py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type here…" maxLength={2000} disabled={pending} />
        <button type="submit" className="btn-primary btn-sm shrink-0" disabled={pending || !text.trim()}>Send</button>
      </form>
    </div>
  );
}
