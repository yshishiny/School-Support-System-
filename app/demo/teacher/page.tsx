import Link from "next/link";
import { CHARACTERS } from "@/lib/characters";
import { Teacher } from "@/components/teach/Teacher";
import { APP_NAME, APP_VERSION } from "@/lib/version";

/** Public: meet the four teachers and watch a sample lesson on the animated stage. No sign-in, no data. */
export default function DemoTeacherPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      <header className="space-y-1">
        <div className="text-xs muted">{APP_NAME} · v{APP_VERSION} · demo</div>
        <h1 className="h1">Meet the teachers</h1>
        <p className="text-sm muted">Pick one and watch a sample lesson: the teacher walks in, talks, writes on the board, asks you two questions and celebrates. Turn the sound on.</p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        {CHARACTERS.map((c) => (
          <div key={c.id} className="card !p-3 text-center space-y-2">
            <div className="flex justify-center"><Teacher c={c} size={140} gesture="idle" mood="happy" /></div>
            <div className="font-bold">{c.emoji} {c.name}</div>
            <div className="text-xs muted">{c.tagline}</div>
            <div className="flex gap-1.5 justify-center">
              <Link href={`/demo/teacher/lesson?c=${c.id}`} className="btn-primary btn-sm">▶ English</Link>
              <Link href={`/demo/teacher/lesson?c=${c.id}&lang=ar`} className="btn-ghost btn-sm">▶ عربي</Link>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs muted"><Link href="/demo/teacher/rig" className="underline">Rig gallery</Link> · <Link href="/login" className="underline">Sign in</Link></p>
    </main>
  );
}
