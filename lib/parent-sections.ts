/** The parent area's sections: the desktop side menu, the phone More grid and the bottom bar all read this one list. */
export interface ParentSection { href: string; label: string; emoji: string; group: string }

/**
 * No colour here, deliberately.
 *
 * This list used to carry sixteen unrelated hex values — two cyans, three oranges, two teals, a magenta — one
 * per section, and nothing anywhere told a parent what magenta meant. Colour that identifies everything
 * identifies nothing, and leaves the accent with no voice on the day something is genuinely waiting. Identity
 * belongs to the icon and to the group, which are already unique; the accent is spent on state alone — the page
 * you are on, and the thing that needs you now.
 */
export const PARENT_SECTIONS: ParentSection[] = [
  { href: "/parent", label: "Home", emoji: "🏠", group: "Today" },
  { href: "/parent/notifications", label: "Inbox", emoji: "🔔", group: "Today" },
  { href: "/parent/children", label: "Kids", emoji: "🧒", group: "Today" },
  { href: "/parent/assignments", label: "Tasks", emoji: "📝", group: "Today" },
  { href: "/parent/plan", label: "Quiz plan", emoji: "📅", group: "Learning" },
  { href: "/parent/progress", label: "Progress", emoji: "🧠", group: "Learning" },
  { href: "/parent/materials", label: "School files", emoji: "📎", group: "Learning" },
  { href: "/parent/import", label: "Import", emoji: "💬", group: "Learning" },
  { href: "/parent/allowance", label: "Allowance", emoji: "💵", group: "Fairness" },
  { href: "/parent/manners", label: "Manners", emoji: "🤝", group: "Fairness" },
  { href: "/parent/snaps", label: "Snaps", emoji: "📸", group: "Fairness" },
  { href: "/parent/rewards", label: "Rewards", emoji: "🎁", group: "Fairness" },
  { href: "/parent/reports", label: "Reports", emoji: "📨", group: "Family" },
  { href: "/parent/guide", label: "Guide", emoji: "❓", group: "Family" },
  { href: "/parent/settings", label: "More", emoji: "⚙️", group: "Family" },
];
