import { requireStudent } from "@/lib/auth";
import { BottomNav } from "@/components/Nav";
import { themeById, themeStyle } from "@/lib/themes";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStudent();
  const theme = themeById(profile.theme);
  return (
    <div className="theme-root" style={themeStyle(theme) as React.CSSProperties} data-theme={theme.id}>
      <div className="mx-auto max-w-3xl px-4 pt-4 pb-24 overflow-x-clip">
      {children}
      <BottomNav
        items={[
          { href: "/today", label: "Today", emoji: "🔥" },
          { href: "/snaps", label: "Snaps", emoji: "📸" },
          { href: "/learn", label: "Learn", emoji: "🧠" },
          { href: "/coach", label: "Coach", emoji: "🦸" },
          { href: "/calendar", label: "Planner", emoji: "🗓️" },
          { href: "/allowance", label: "Allowance", emoji: "💵" },
          { href: "/rewards", label: "Rewards", emoji: "🎁" },
          { href: "/me", label: "Me", emoji: "🧑‍🚀" },
        ]}
      />
      </div>
    </div>
  );
}
