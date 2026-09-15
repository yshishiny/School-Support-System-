import Link from "next/link";
import { requireParent } from "@/lib/auth";

const STEPS: { emoji: string; title: string; body: string; href: string; cta: string }[] = [
  { emoji: "👦", title: "Kids and timetables", body: "Each child has a login. Their school timetable drives everything: which classes to ask about, which quizzes to prepare, which subjects count. Update it from a photo when the school changes it.", href: "/parent/children", cta: "Kids" },
  { emoji: "💬", title: "WhatsApp groups", body: "Photos or the exported chat from the class group become tasks after you approve them. Whole-year exports go to the Chat archive, where the app studies how each group announces homework and quizzes.", href: "/parent/import", cta: "Import" },
  { emoji: "📅", title: "The weekly plan", body: "Every school day gets ready-made quizzes: English-track subject, Arabic subject, and SAT/ACT for high school. Press Prepare once; the app tops it up every night. Levels follow the coach's analysis.", href: "/parent/plan", cta: "Plan" },
  { emoji: "🧠", title: "Progress and the coach", body: "Mastery per topic, exam estimates, and the coach's weekly analysis: which subjects need foundations, where to push harder. Run it any time. The wellbeing light shows green, amber or red only.", href: "/parent/progress", cta: "Progress" },
  { emoji: "🎁", title: "Rewards", body: "Set up cash or non-cash rewards with a points price. Kids redeem; you approve on the home page. Points follow the guide the kids see: check-in, class notes, prayers, practice, streaks.", href: "/parent/rewards", cta: "Rewards" },
  { emoji: "📨", title: "Daily report", body: "Every evening a summary reaches you on Telegram: check-in, prayers, what they covered, practice, points, and the coach's headline. Send it now from Reports.", href: "/parent/reports", cta: "Reports" },
  { emoji: "🚨", title: "When to step in", body: "The coach chat and check-ins are private to each child. You are told only when there is danger: a red alert on Telegram and on your home page, with no quotes. Amber means a calm chat this week would help. Everything else, let them own.", href: "/parent", cta: "Home" },
];

export default async function ParentGuidePage() {
  await requireParent();
  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">How it works</h1>
        <Link href="/parent" className="btn-ghost btn-sm">← Home</Link>
      </div>
      <p className="text-sm muted">Your side takes five minutes a week. The kids' side takes five minutes a day. Here is the loop.</p>
      {STEPS.map((s, i) => (
        <section key={s.title} className="card flex items-start gap-3">
          <span className="text-4xl sticker-still">{s.emoji}</span>
          <div className="flex-1">
            <div className="font-bold">{i + 1}. {s.title}</div>
            <p className="text-sm muted mt-0.5">{s.body}</p>
          </div>
          <Link href={s.href} className="btn-ghost btn-sm shrink-0">{s.cta}</Link>
        </section>
      ))}
      <section className="card text-sm space-y-1">
        <div className="font-bold">A good first week</div>
        <ol className="list-decimal pl-5 space-y-1 muted">
          <li>Each boy logs in, takes the tour (it opens by itself), picks a theme, fills "What I love" and "Tell your coach about you".</li>
          <li>Tonight: check-in with class notes, prayers, today&apos;s planned quiz.</li>
          <li>You: press Prepare on the Plan tab, add two rewards, connect Telegram if not yet.</li>
          <li>After a week: run the coach on Progress and read the daily report every evening.</li>
        </ol>
      </section>
    </main>
  );
}
