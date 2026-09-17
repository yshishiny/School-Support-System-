import { requireParent } from "@/lib/auth";
import { ParentMenu } from "@/components/ParentMenu";

/** Parent area: a colourful side menu (left on wide screens, a strip on phones) and the page beside it. */
export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  await requireParent();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-3 pb-10">
      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <ParentMenu />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
