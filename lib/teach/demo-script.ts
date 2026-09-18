import type { LessonScript } from "@/lib/ai/lesson-script";

/** A sample lesson for the public demo and for trying the stage without a script of your own. */
export const DEMO_EN: LessonScript = {
  title: "Adding fractions with the same denominator",
  minutes: 8,
  beats: [
    { kind: "hook", say: "Imagine a pizza cut into eight equal slices. You eat three slices, your brother eats two. How much of the pizza is gone? By the end of this lesson you will add fractions like these in your head.", show: null, check: null, gesture: "wave", mood: "happy" },
    { kind: "explain", say: "A fraction has two parts. The bottom number, the denominator, tells us how many equal pieces the whole is cut into. The top number, the numerator, tells us how many of those pieces we have.", show: { type: "text", content: "Numerator: how many pieces we have\nDenominator: how many equal pieces in the whole" }, check: null, gesture: "point", mood: "neutral" },
    { kind: "explain", say: "Look at the pizza. Three slices are yours, two are your brother's. Every slice is one eighth. Same size pieces means we can simply count them together.", show: { type: "svg", content: "<svg viewBox='0 0 320 180'><circle cx='90' cy='90' r='70' fill='#f6d27a' stroke='#8a5a34' stroke-width='4'/><path d='M90 90 L160 90 A70 70 0 0 1 139.5 139.5 Z' fill='#e63946'/><path d='M90 90 L139.5 139.5 A70 70 0 0 1 90 160 Z' fill='#e63946'/><path d='M90 90 L90 160 A70 70 0 0 1 40.5 139.5 Z' fill='#e63946'/><path d='M90 90 L40.5 139.5 A70 70 0 0 1 20 90 Z' fill='#2a9d8f'/><path d='M90 90 L20 90 A70 70 0 0 1 40.5 40.5 Z' fill='#2a9d8f'/><line x1='90' y1='20' x2='90' y2='160' stroke='#8a5a34' stroke-width='3'/><line x1='20' y1='90' x2='160' y2='90' stroke='#8a5a34' stroke-width='3'/><line x1='40.5' y1='40.5' x2='139.5' y2='139.5' stroke='#8a5a34' stroke-width='3'/><line x1='139.5' y1='40.5' x2='40.5' y2='139.5' stroke='#8a5a34' stroke-width='3'/><text x='190' y='70' font-size='22' fill='#e63946' font-weight='bold'>3/8 you</text><text x='190' y='110' font-size='22' fill='#2a9d8f' font-weight='bold'>2/8 brother</text></svg>" }, check: null, gesture: "point", mood: "happy" },
    { kind: "example", say: "Here is the rule. When the denominators are the same, add the numerators and keep the denominator. Three eighths plus two eighths: three plus two is five, and the pieces are still eighths. Five eighths of the pizza is gone.", show: { type: "steps", content: "1. Check the denominators: 8 and 8, the same\n2. Add the numerators: 3 + 2 = 5\n3. Keep the denominator: 8\n4. Answer: 5/8" }, check: null, gesture: "write", mood: "neutral" },
    { kind: "check", say: "Your turn. Two fifths plus one fifth. Take your time and pick the answer on the board.", show: null, check: { question: "2/5 + 1/5 = ?", choices: ["3/10", "3/5", "2/10", "1/5"], correct_index: 1, hint: "Same denominator, so only the top numbers add up. The bottom number stays five.", explanation: "Two plus one is three, and the pieces are still fifths, so the answer is three fifths." }, gesture: "think", mood: "think" },
    { kind: "explain", say: "Written as a formula it looks like this. The letters a and b are the numerators, and c is the shared denominator. Only the top changes.", show: { type: "formula", content: "a⁄c + b⁄c = (a + b)⁄c" }, check: null, gesture: "write", mood: "neutral" },
    { kind: "check", say: "One more. Four ninths plus four ninths. Careful with the bottom number.", show: null, check: { question: "4/9 + 4/9 = ?", choices: ["8/18", "8/9", "16/9", "4/9"], correct_index: 1, hint: "Do not add the denominators. Nine stays nine.", explanation: "Four plus four is eight, over the same nine: eight ninths." }, gesture: "think", mood: "think" },
    { kind: "recap", say: "Course set. Same denominator: add the tops, keep the bottom. Next time we will meet fractions with different denominators, and you will need one extra step.", show: { type: "table", content: "Sum | Add tops | Keep bottom | Answer\n3/8 + 2/8 | 5 | 8 | 5/8\n2/5 + 1/5 | 3 | 5 | 3/5\n4/9 + 4/9 | 8 | 9 | 8/9" }, check: null, gesture: "celebrate", mood: "encourage" },
  ],
  quiz: [
    { prompt: "1/6 + 4/6 = ?", choices: ["5/12", "5/6", "4/6", "1/6"], correct_index: 1, explanation: "Add the numerators, keep the denominator.", skill_tag: "Math: fractions" },
    { prompt: "Which number is the denominator in 7/10?", choices: ["7", "10", "17", "70"], correct_index: 1, explanation: "The bottom number is the denominator.", skill_tag: "Math: fractions" },
    { prompt: "3/7 + 3/7 = ?", choices: ["6/14", "9/7", "6/7", "3/7"], correct_index: 2, explanation: "Three plus three over seven.", skill_tag: "Math: fractions" },
  ],
};

export const DEMO_AR: LessonScript = {
  title: "جمع الكسور ذات المقام الموحّد",
  minutes: 6,
  beats: [
    { kind: "hook", say: "كان يا ما كان، فطيرة مقسومة إلى ثمانية أجزاء متساوية. أكلتَ ثلاثة أجزاء وأكل أخوك جزأين. كم ذهب من الفطيرة؟ في نهاية الدرس ستجمع الكسور بسهولة.", show: null, check: null, gesture: "wave", mood: "happy" },
    { kind: "explain", say: "للكسر جزآن. العدد السفلي هو المقام ويخبرنا بعدد الأجزاء المتساوية. والعدد العلوي هو البسط ويخبرنا بعدد الأجزاء التي معنا.", show: { type: "text", content: "البسط: عدد الأجزاء التي معنا\nالمقام: عدد الأجزاء المتساوية في الكل" }, check: null, gesture: "point", mood: "neutral" },
    { kind: "example", say: "القاعدة بسيطة. إذا تساوى المقامان نجمع البسطين ونبقي المقام كما هو. ثلاثة أثمان زائد ثُمنين تساوي خمسة أثمان.", show: { type: "steps", content: "١. نتأكد أن المقامين متساويان: ٨ و ٨\n٢. نجمع البسطين: ٣ + ٢ = ٥\n٣. نبقي المقام: ٨\n٤. الناتج: ٥/٨" }, check: null, gesture: "write", mood: "neutral" },
    { kind: "check", say: "دورك الآن. خُمسان زائد خُمس. اختر الإجابة على السبورة.", show: null, check: { question: "٢/٥ + ١/٥ = ؟", choices: ["٣/١٠", "٣/٥", "٢/١٠", "١/٥"], correct_index: 1, hint: "المقام واحد، فنجمع البسطين فقط. يبقى المقام خمسة.", explanation: "اثنان زائد واحد يساوي ثلاثة، والمقام خمسة، فالناتج ثلاثة أخماس." }, gesture: "think", mood: "think" },
    { kind: "recap", say: "والآن الحقيقة بلا حكاية: مقام واحد يعني نجمع البسطين ونبقي المقام. أحسنت.", show: { type: "formula", content: "أ⁄ج + ب⁄ج = (أ + ب)⁄ج" }, check: null, gesture: "celebrate", mood: "encourage" },
  ],
  quiz: [
    { prompt: "١/٦ + ٤/٦ = ؟", choices: ["٥/١٢", "٥/٦", "٤/٦", "١/٦"], correct_index: 1, explanation: "نجمع البسطين ونبقي المقام.", skill_tag: "رياضيات: الكسور" },
    { prompt: "ما المقام في ٧/١٠؟", choices: ["٧", "١٠", "١٧", "٧٠"], correct_index: 1, explanation: "العدد السفلي هو المقام.", skill_tag: "رياضيات: الكسور" },
    { prompt: "٣/٧ + ٣/٧ = ؟", choices: ["٦/١٤", "٩/٧", "٦/٧", "٣/٧"], correct_index: 2, explanation: "ثلاثة زائد ثلاثة على سبعة.", skill_tag: "رياضيات: الكسور" },
  ],
};
