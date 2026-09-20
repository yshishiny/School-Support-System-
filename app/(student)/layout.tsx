import { requireStudent } from "@/lib/auth";
import { BottomNav } from "@/components/Nav";
import { themeById, themeStyle } from "@/lib/themes";
import { SiteBadge } from "@/components/SiteBadge";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStudent();
  const theme = themeById(profile.theme);
  return (
    <div className="theme-root" style={themeStyle(theme) as React.CSSProperties} data-theme={theme.id}>
      <SiteBadge />
      <div className="mx-auto max-w-3xl px-4 pt-4 pb-24 overflow-x-clip">
      {children}
      {/*
        Five, and only five. Teacher and Coach sit at the top of Learn, Wallet and Rewards at the top of
        Allowance, the Planner on Me, and a rater's Check on Snaps — see components/Seated.tsx. A sixth item
        here costs every other item the width it needs to be hit.
      */}
      <BottomNav
        items={[
          { href: "/today", label: "Today", emoji: "🔥" },
          { href: "/learn", label: "Learn", emoji: "🧠" },
          { href: "/snaps", label: "Snaps", emoji: "📸" },
          { href: "/allowance", label: "Allowance", emoji: "💵" },
          { href: "/me", label: "Me", emoji: "🧑‍🚀" },
        ]}
      />
      </div>
    </div>
  );
}
