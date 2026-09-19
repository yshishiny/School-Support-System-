/** The parent area's sections: the desktop side menu, the phone More grid and the bottom bar all read this one list. */
export interface ParentSection { href: string; label: string; emoji: string; color: string; group: string }

export const PARENT_SECTIONS: ParentSection[] = [
  { href: "/parent", label: "Home", emoji: "🏠", color: "#3a86ff", group: "Today" },
  { href: "/parent/notifications", label: "Inbox", emoji: "🔔", color: "#f15bb5", group: "Today" },
  { href: "/parent/children", label: "Kids", emoji: "🧒", color: "#ff6b6b", group: "Today" },
  { href: "/parent/assignments", label: "Tasks", emoji: "📝", color: "#ffbe0b", group: "Today" },
  { href: "/parent/access", label: "Teacher access", emoji: "🎓", color: "#d9b061", group: "Learning" },
  { href: "/parent/plan", label: "Quiz plan", emoji: "📅", color: "#2ec4b6", group: "Learning" },
  { href: "/parent/progress", label: "Progress", emoji: "🧠", color: "#8338ec", group: "Learning" },
  { href: "/parent/materials", label: "School files", emoji: "📎", color: "#fb5607", group: "Learning" },
  { href: "/parent/import", label: "Import", emoji: "💬", color: "#06d6a0", group: "Learning" },
  { href: "/parent/allowance", label: "Allowance", emoji: "💵", color: "#e0a800", group: "Fairness" },
  { href: "/parent/manners", label: "Manners", emoji: "🤝", color: "#f77f00", group: "Fairness" },
  { href: "/parent/snaps", label: "Snaps", emoji: "📸", color: "#ef476f", group: "Fairness" },
  { href: "/parent/rewards", label: "Rewards", emoji: "🎁", color: "#118ab2", group: "Fairness" },
  { href: "/parent/reports", label: "Reports", emoji: "📨", color: "#0e7c86", group: "Family" },
  { href: "/parent/guide", label: "Guide", emoji: "❓", color: "#9b5de5", group: "Family" },
  { href: "/parent/settings", label: "More", emoji: "⚙️", color: "#6c757d", group: "Family" },
];
