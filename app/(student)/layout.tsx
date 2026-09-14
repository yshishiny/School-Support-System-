import { requireStudent } from "@/lib/auth";
import { BottomNav } from "@/components/Nav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-24">
      {children}
      <BottomNav
        items={[
          { href: "/today", label: "Today", emoji: "🔥" },
          { href: "/learn", label: "Learn", emoji: "🧠" },
          { href: "/calendar", label: "Planner", emoji: "🗓️" },
          { href: "/rewards", label: "Rewards", emoji: "🎁" },
          { href: "/me", label: "Me", emoji: "🧑‍🚀" },
        ]}
      />
    </div>
  );
}
