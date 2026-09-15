"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { finishTourAction } from "@/lib/actions/tour";
import { DemoQuiz } from "./DemoQuiz";

interface Slide {
  emoji: string;
  title: string;
  points: string[];
  extra?: ReactNode;
}

export function Tour({ firstName, mascot, stickers, alreadySeen }: { firstName: string; mascot: string; stickers: string[]; alreadySeen: boolean }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [pending, start] = useTransition();
  const [earned, setEarned] = useState<number | null>(null);

  const slides: Slide[] = [
    { emoji: mascot, title: `Welcome, ${firstName}!`, points: ["This is your study base. Five minutes a day, real points, real rewards.", "Your coach lives here too. It knows your timetable, your subjects and what you like.", "Swipe through this once. It takes two minutes and pays 10 points."], extra: <div className="text-4xl flex gap-3 justify-center">{stickers.map((s) => <span key={s} className="sticker" style={{ animationDelay: `${Math.random()}s` }}>{s}</span>)}</div> },
    { emoji: "🔥", title: "Today", points: ["Every evening: tap Submit check-in. That is +10 and keeps your streak.", "For each class you had, tap the lesson title. Not sure? The 🤖 helper guesses from a hint. +2 per class.", "The prayer pill top-right: tap it after each prayer. On time +3, all five +10.", "Homework the teacher gave shows up as tasks. Mark them honestly."] },
    { emoji: "📅", title: "Your week's quizzes", points: ["Every school day has quizzes ready: one on your English-track subjects, one in Arabic, and SAT/ACT in high school.", "Do today's on the day for +5 extra. Missed one? It waits for you as catch-up.", "Every set explains each answer. Wrong ones come back later in Review, at the right time."], extra: <DemoQuiz /> },
    { emoji: "🧠", title: "Learn", points: ["Tabs: ⭐ For me (what to fix first), 📚 Subjects, 🎓 SAT & ACT, 📿 Quran.", "Any topic: Practice (easy, medium, hard), Lesson (\"explain this to me\" in your style), My sets.", "📿 القرآن والحديث: add what your Religion teacher set, read, hide, recite from memory."] },
    { emoji: "🦸", title: "Coach", points: ["Talk: a private chat. Stressed, annoyed, worried about anything, or just football. Type it.", "What you write stays between you and the coach. The only exception: if the coach thinks you are in danger, your parents are told so someone is with you, and you are told too.", "Check-in: a few taps every week or month about how you feel. Your parents only see a green, yellow or red light.", "My plan: what to work on and where you are strong, written for you."] },
    { emoji: "🎁", title: "Points and rewards", points: ["Check-in +10, each class note +2, prayers up to +25, practice up to +60 a day, planned quiz on the day +5.", "Streaks pay the most: 3 days +20, 7 days +50, 14 days +100, 30 days +250.", "Rewards: cash or things your parents set up. Redeem in the Rewards tab; they approve."] },
    { emoji: "🧑‍🚀", title: "Make it yours", points: ["Me → Theme: your club or your future career changes the colours and the mascots.", "Me → What I love: word problems use your interests. Favourite subjects get first pick.", "Me → Tell your coach about you: ten questions so lessons and the coach fit how you learn. +15."] },
    { emoji: "🚀", title: "Ready", points: ["Tonight: submit your check-in and tap your prayers.", "Then open today's quiz from the home page.", "Ask the coach anything. Let's go."] },
  ];
  const s = slides[i];
  const last = i === slides.length - 1;

  function finish() {
    start(async () => {
      const r = alreadySeen ? { earned: 0 } : await finishTourAction();
      setEarned(r.earned);
      setTimeout(() => router.push("/today"), r.earned > 0 ? 1400 : 200);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {slides.map((_, k) => (
          <button key={k} type="button" onClick={() => setI(k)} className={`h-2 flex-1 rounded-full ${k <= i ? "bg-accent" : "bg-panel-2"}`} aria-label={`Step ${k + 1}`} />
        ))}
      </div>
      <section className="card space-y-3 pop" key={i}>
        <div className="flex items-center gap-3">
          <span className="text-6xl sticker-still">{s.emoji}</span>
          <h2 className="h1">{s.title}</h2>
        </div>
        <ul className="space-y-2 text-sm">
          {s.points.map((p, k) => (
            <li key={k} className="flex gap-2"><span className="text-accent-2">●</span><span>{p}</span></li>
          ))}
        </ul>
        {s.extra}
        {earned !== null && earned > 0 && <div className="text-center text-2xl font-extrabold text-accent-2 pop">+{earned} points 🎉</div>}
        <div className="flex items-center justify-between pt-1">
          <button type="button" className="text-sm muted" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>← Back</button>
          <span className="text-xs muted">{i + 1} / {slides.length}</span>
          {last ? (
            <button type="button" className="btn-primary" onClick={finish} disabled={pending}>{pending ? "…" : "Let's go 🚀"}</button>
          ) : (
            <button type="button" className="btn-primary btn-sm" onClick={() => setI(i + 1)}>Next →</button>
          )}
        </div>
      </section>
      {!alreadySeen && <p className="text-center text-xs muted"><button type="button" className="underline" onClick={finish}>Skip the tour</button></p>}
    </div>
  );
}
