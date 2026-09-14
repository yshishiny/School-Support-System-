import { requireParent } from "@/lib/auth";
import { BottomNav } from "@/components/Nav";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  await requireParent();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-24">
      {children}
      <BottomNav
        items={[
          { href: "/parent", label: "Home", emoji: "🏠" },
          { href: "/parent/assignments", label: "Tasks", emoji: "📝" },
          { href: "/parent/import", label: "WhatsApp", emoji: "💬" },
          { href: "/parent/rewards", label: "Rewards", emoji: "🎁" },
          { href: "/parent/settings", label: "More", emoji: "⚙️" },
        ]}
      />
    </div>
  );
}
