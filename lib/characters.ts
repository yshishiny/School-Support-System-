/**
 * The virtual teachers. Original characters, ours. One is chosen per child and teaches every subject;
 * the knowledge is the same, the manner differs. Voice settings apply to browser speech.
 */
export interface Character {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  colors: { skin: string; hair: string; top: string; accent: string };
  hat?: "cap" | "beanie" | "none" | "scarf";
  style: string; // how they speak, for the script writer
  voice: { rate: number; pitch: number; preferFemale?: boolean };
  catchphrase: string;
}

export const CHARACTERS: Character[] = [
  {
    id: "nova",
    name: "Captain Nova",
    tagline: "Space captain. Calm, precise, loves a good diagram.",
    emoji: "🚀",
    colors: { skin: "#f1c27d", hair: "#2b2d42", top: "#3a86ff", accent: "#ffd166" },
    hat: "none",
    style: "Calm and precise like a mission commander. Uses space and navigation metaphors sparingly, never more than once per lesson. Short sentences. Praises accuracy.",
    voice: { rate: 0.95, pitch: 0.9 },
    catchphrase: "Course set. Let's go.",
  },
  {
    id: "zizo",
    name: "Coach Zizo",
    tagline: "Football coach. Energetic, drills and match examples.",
    emoji: "⚽",
    colors: { skin: "#c68642", hair: "#1b1b1b", top: "#2ec4b6", accent: "#ffffff" },
    hat: "cap",
    style: "Energetic football coach. Frames practice as drills and matches; uses stats and scores in examples. Cheerful, direct, never sarcastic. Celebrates effort.",
    voice: { rate: 1.05, pitch: 1.05 },
    catchphrase: "Warm-up done. Kick-off!",
  },
  {
    id: "layla",
    name: "Dr. Layla",
    tagline: "Scientist. Curious, asks 'why', explains with experiments.",
    emoji: "🔬",
    colors: { skin: "#e8beac", hair: "#5a3825", top: "#ffffff", accent: "#8338ec" },
    hat: "none",
    style: "Curious scientist. Starts from a question, builds the answer step by step, points out common misconceptions. Warm and patient. Uses everyday experiments as examples.",
    voice: { rate: 0.98, pitch: 1.1, preferFemale: true },
    catchphrase: "Let's find out.",
  },
  {
    id: "hakawati",
    name: "Am Hassan the Hakawati",
    tagline: "Storyteller. Best for Arabic, history and religion.",
    emoji: "📜",
    colors: { skin: "#b07a4f", hair: "#d9d9d9", top: "#8d5524", accent: "#e9c46a" },
    hat: "scarf",
    style: "A warm Egyptian storyteller. Wraps facts in a short story or a memorable line, then states the fact plainly. Respectful and unhurried. In Arabic lessons, speaks clear Modern Standard Arabic with an Egyptian warmth.",
    voice: { rate: 0.92, pitch: 0.85 },
    catchphrase: "كان يا ما كان... and now the fact.",
  },
];

export function characterById(id: string | null | undefined): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
