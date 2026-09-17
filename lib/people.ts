/** Age, birthdays and stage of life. Pure. */
export type Stage = "school" | "university" | "postgraduate" | "adult";
export const STAGES: { id: Stage; label: string; emoji: string }[] = [
  { id: "school", label: "School", emoji: "🎒" },
  { id: "university", label: "University", emoji: "🎓" },
  { id: "postgraduate", label: "Postgraduate", emoji: "📚" },
  { id: "adult", label: "Adult learner", emoji: "💼" },
];

export function ageOn(birthDate: string | null | undefined, today: string): number | null {
  if (!birthDate) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

export function isBirthday(birthDate: string | null | undefined, today: string): boolean {
  return !!birthDate && birthDate.slice(5) === today.slice(5);
}

/** Days until the next birthday (0 = today), or null. */
export function daysToBirthday(birthDate: string | null | undefined, today: string): number | null {
  if (!birthDate) return null;
  const [, bm, bd] = birthDate.split("-").map(Number);
  const [ty] = today.split("-").map(Number);
  const t = Date.parse(today + "T00:00:00Z");
  for (const y of [ty, ty + 1]) {
    const d = Date.UTC(y, bm - 1, bd);
    if (d >= t) return Math.round((d - t) / 86400000);
  }
  return null;
}

/** One line for prompts: "Youssef, 15 years old, school grade 10" / "Sara, 24, postgraduate". */
export function learnerLine(p: { full_name: string; grade: number | null; stage?: Stage | null; birth_date?: string | null }, today: string): string {
  const age = ageOn(p.birth_date, today);
  const stage = p.stage ?? "school";
  const where = stage === "school" ? (p.grade ? `school grade ${p.grade}` : "school") : STAGES.find((s) => s.id === stage)?.label.toLowerCase() ?? stage;
  return `${p.full_name.split(" ")[0]}${age !== null ? `, ${age} years old` : ""}, ${where}`;
}

/** How the coach should talk, by stage. */
export function stageTone(stage: Stage | null | undefined): string {
  switch (stage) {
    case "university":
      return "Speak to a university student as a peer mentor: no childish framing, focus on time management, deep understanding and exam strategy.";
    case "postgraduate":
      return "Speak to a postgraduate as a colleague: assume strong foundations, push for rigour, research habits, and clear writing; no gamified language.";
    case "adult":
      return "Speak to an adult learner with respect for their time: practical, concise, no points talk unless they raise it.";
    default:
      return "";
  }
}
