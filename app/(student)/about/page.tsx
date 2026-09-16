import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { About } from "@/components/About";

export default async function StudentAboutPage() {
  await requireStudent();
  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">About</h1>
        <Link href="/me" className="btn-ghost btn-sm">← Me</Link>
      </div>
      <About role="student" />
    </main>
  );
}
