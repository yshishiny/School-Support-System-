/**
 * What the voice actually says. Scripts are asked to write words, but symbols slip in ("3/8", "x²", "∠A", "90°"),
 * and a voice reads those as "three slash eight" or "x two". This turns them into spoken words, in the lesson's
 * language, before any voice (the phone's, Azure, D-ID) sees the line. Captions keep the original text.
 */
const EN: [RegExp, string][] = [
  [/(\d+)\s*\/\s*(\d+)/g, "$1 over $2"],
  [/\s*\+\s*/g, " plus "],
  [/(\d|\))\s*[−–-]\s*(\d|\()/g, "$1 minus $2"],
  [/\s*[×*]\s*/g, " times "],
  [/\s*÷\s*/g, " divided by "],
  [/\s*=\s*/g, " equals "],
  [/\s*≠\s*/g, " is not equal to "],
  [/\s*≈\s*/g, " is about "],
  [/\s*≤\s*/g, " is less than or equal to "],
  [/\s*≥\s*/g, " is greater than or equal to "],
  [/\s*<\s*/g, " is less than "],
  [/\s*>\s*/g, " is greater than "],
  [/²/g, " squared"],
  [/³/g, " cubed"],
  [/√\s*\(?([^)\s]+)\)?/g, "the square root of $1"],
  [/(\d)\s*°/g, "$1 degrees"],
  [/°/g, " degrees"],
  [/(\d)\s*%/g, "$1 percent"],
  [/∠\s*/g, "angle "],
  [/\s*∥\s*/g, " is parallel to "],
  [/\s*⊥\s*/g, " is perpendicular to "],
  [/π/g, "pi"],
  [/\bΔ\s*/g, "triangle "],
  [/\s*→\s*/g, " to "],
  [/\bDr\./g, "Doctor"],
  [/\bvs\.?\b/gi, "versus"],
  [/\be\.g\.\s*/gi, "for example, "],
  [/\bi\.e\.\s*/gi, "that is, "],
  [/\betc\.?/gi, "and so on"],
];

const AR: [RegExp, string][] = [
  [/([\d٠-٩]+)\s*\/\s*([\d٠-٩]+)/g, "$1 على $2"],
  [/\s*\+\s*/g, " زائد "],
  [/([\d٠-٩)])\s*[−–-]\s*([\d٠-٩(])/g, "$1 ناقص $2"],
  [/\s*[×*]\s*/g, " في "],
  [/\s*÷\s*/g, " على "],
  [/\s*=\s*/g, " يساوي "],
  [/\s*≠\s*/g, " لا يساوي "],
  [/\s*<\s*/g, " أصغر من "],
  [/\s*>\s*/g, " أكبر من "],
  [/²/g, " تربيع"],
  [/³/g, " تكعيب"],
  [/√\s*\(?([^)\s]+)\)?/g, "الجذر التربيعي لـ $1"],
  [/([\d٠-٩])\s*°/g, "$1 درجة"],
  [/°/g, " درجة"],
  [/([\d٠-٩])\s*%/g, "$1 بالمئة"],
  [/∠\s*/g, "الزاوية "],
  [/\s*∥\s*/g, " يوازي "],
  [/\s*⊥\s*/g, " يعامد "],
  [/π/g, "باي"],
  [/\s*→\s*/g, " إلى "],
];

export function speakable(text: string, language: "en" | "ar"): string {
  let s = text;
  for (const [re, to] of language === "ar" ? AR : EN) s = s.replace(re, to);
  // Letter pairs that name segments and lines ("AB", "CD") read better spelled out.
  if (language === "en") s = s.replace(/\b([A-Z])([A-Z])\b/g, "$1 $2");
  return s.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?؟،])/g, "$1").trim();
}
