"use client";

import { useState } from "react";

const DEMO = [
  { prompt: "Real Madrid scored 3 goals in each of 4 matches. How many goals in total?", choices: ["7", "12", "16", "34"], correct: 1, why: "3 goals × 4 matches = 12. Multiplication is repeated addition: 3 + 3 + 3 + 3." },
  { prompt: "Which word is a verb in: 'The goalkeeper jumped high'?", choices: ["goalkeeper", "high", "jumped", "the"], correct: 2, why: "A verb is the action. 'Jumped' is what the goalkeeper did." },
  { prompt: "ما جمع كلمة «كتاب»؟", choices: ["كاتب", "كُتُب", "مكتبة", "كتابة"], correct: 1, why: "كُتُب هي جمع تكسير لكلمة كتاب. أما كاتب فاسم فاعل، ومكتبة مكان." },
];

/** Three throw-away questions so the boy sees how a set feels: tap, see the answer and why, next. Nothing is saved. */
export function DemoQuiz() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = DEMO[i];
  const done = i >= DEMO.length;
  if (done) {
    return (
      <div className="tile text-center space-y-1 pop">
        <div className="text-4xl">{score === DEMO.length ? "🌟" : "👍"}</div>
        <div className="font-bold">{score}/{DEMO.length} in the demo</div>
        <div className="text-xs muted">Real sets are 6 to 8 questions, pay points, and remember what you got wrong for review later.</div>
        <button type="button" className="btn-ghost btn-sm" onClick={() => { setI(0); setPicked(null); setScore(0); }}>Try again</button>
      </div>
    );
  }
  const rtl = /[؀-ۿ]/.test(q.prompt);
  return (
    <div className="tile space-y-2" dir={rtl ? "rtl" : undefined}>
      <div className="text-xs muted" dir="ltr">Demo · {i + 1}/{DEMO.length} · nothing is saved</div>
      <div className="font-semibold">{q.prompt}</div>
      <div className="grid gap-1.5">
        {q.choices.map((c, k) => {
          const state = picked === null ? "" : k === q.correct ? "border-good bg-good/15" : k === picked ? "border-bad bg-bad/15" : "opacity-60";
          return (
            <button key={k} type="button" disabled={picked !== null} onClick={() => { setPicked(k); if (k === q.correct) setScore(score + 1); }} className={`rounded-xl border-2 border-line px-3 py-2 text-left text-sm transition ${state}`}>
              {c}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="text-sm rounded-xl bg-panel-2 p-2 pop">
          <b>{picked === q.correct ? "Correct!" : "Not quite."}</b> {q.why}
          <div className="mt-1" dir="ltr"><button type="button" className="btn-primary btn-sm" onClick={() => { setI(i + 1); setPicked(null); }}>Next</button></div>
        </div>
      )}
    </div>
  );
}
