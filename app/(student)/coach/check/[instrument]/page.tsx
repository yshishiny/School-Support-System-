import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { INSTRUMENTS, type Instrument } from "@/lib/wellbeing";
import { CheckRunner } from "@/components/CheckRunner";

export const maxDuration = 60;

export default async function CheckPage({ params }: { params: Promise<{ instrument: string }> }) {
  const { instrument } = await params;
  await requireStudent();
  const def = INSTRUMENTS[instrument as Instrument];
  if (!def) notFound();
  return (
    <main className="space-y-4">
      <Link href="/coach" className="text-sm muted">← Coach</Link>
      <header className="card">
        <h1 className="h1">{def.emoji} {def.title}</h1>
        <p className="text-sm muted mt-1">{def.intro}</p>
      </header>
      <CheckRunner instrument={def.id} />
    </main>
  );
}
