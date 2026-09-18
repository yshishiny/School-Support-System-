/**
 * The virtual teachers. Original characters, ours. One is chosen per child and teaches every subject;
 * the knowledge is the same, the manner differs. Voice settings apply to browser speech; the rig
 * describes the animated body drawn by components/teach/Teacher.tsx and the classroom behind it.
 */
export type HairStyle = "short" | "curly" | "long" | "grey";
export type Outfit = "spacesuit" | "tracksuit" | "labcoat" | "galabeya";
export type Prop = "pointer" | "whistle" | "flask" | "book";
export type Scene = "space" | "pitch" | "lab" | "cairo";

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
  rig: { hair: HairStyle; outfit: Outfit; eyes: string; glasses?: boolean; beard?: boolean; prop: Prop; scene: Scene; trousers: string };
  /** What the teacher says when first met, and the line before a check. */
  lines: { hello: string; hello_ar: string; correct: string; correct_ar: string; wrong: string; wrong_ar: string };
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
    rig: { hair: "short", outfit: "spacesuit", eyes: "#2f6fd6", prop: "pointer", scene: "space", trousers: "#23324f" },
    lines: { hello: "Captain Nova here. Course set. Let's go.", hello_ar: "أنا الكابتن نوفا. المسار جاهز، هيا بنا.", correct: "Exactly right. Precise work.", correct_ar: "صحيح تماماً. عمل دقيق.", wrong: "Not quite. Check the instruments and try once more.", wrong_ar: "ليس تماماً. راجع الأدوات وحاول مرة أخرى." },
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
    rig: { hair: "short", outfit: "tracksuit", eyes: "#4a2e14", prop: "whistle", scene: "pitch", trousers: "#1f6f68" },
    lines: { hello: "Coach Zizo! Warm-up done. Kick-off!", hello_ar: "أنا الكابتن زيزو! الإحماء انتهى، هيا نبدأ!", correct: "Goal! That's the one.", correct_ar: "جووول! هذه هي الإجابة.", wrong: "Off the post. Shake it off, one more shot.", wrong_ar: "في القائم! لا بأس، تسديدة أخرى." },
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
    rig: { hair: "long", outfit: "labcoat", eyes: "#3f7d3a", glasses: true, prop: "flask", scene: "lab", trousers: "#5b3fa8" },
    lines: { hello: "I'm Dr. Layla. Let's find out.", hello_ar: "أنا الدكتورة ليلى. هيا نكتشف.", correct: "Yes! The experiment agrees with you.", correct_ar: "نعم! التجربة تتفق معك.", wrong: "Interesting guess. Let's look at the evidence again.", wrong_ar: "تخمين مثير. لننظر إلى الدليل مرة أخرى." },
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
    rig: { hair: "grey", outfit: "galabeya", eyes: "#4a2e14", beard: true, prop: "book", scene: "cairo", trousers: "#6e4220" },
    lines: { hello: "Welcome, my friend. Sit; the story begins.", hello_ar: "أهلاً يا صديقي. اجلس، فالحكاية تبدأ.", correct: "Bravo. You remembered the story.", correct_ar: "أحسنت. لقد تذكرت الحكاية.", wrong: "Patience. Let me tell it once more.", wrong_ar: "صبراً. دعني أحكيها مرة أخرى." },
  },
];

export function characterById(id: string | null | undefined): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
