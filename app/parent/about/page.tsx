import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { About } from "@/components/About";

export default async function ParentAboutPage() {
  await requireParent();
  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">About</h1>
        <Link href="/parent/settings" className="btn-ghost btn-sm">← More</Link>
      </div>
      <About role="parent" />
    </main>
  );
}
