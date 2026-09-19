import type { Character } from "@/lib/characters";

/** The lines the stage says around the script: the same text on the client and in the render job, so clips match. */
export function greetingLine(c: Character, language: "en" | "ar", title: string): string {
  const hello = language === "ar" ? c.lines.hello_ar : c.lines.hello;
  const today = language === "ar" ? `درس اليوم: ${title}.` : `Today's lesson: ${title}.`;
  return `${hello} ${today}`;
}

export function closingLine(language: "en" | "ar"): string {
  return language === "ar" ? "انتهى الدرس! أحسنت. والآن ثلاثة أسئلة سريعة." : "Lesson complete! Well done. Now three quick questions.";
}

/** What the teacher says after a check, built the same way on the client and in the render job so clips match. */
export function correctLine(c: Character, language: "en" | "ar", explanation: string): string {
  return `${language === "ar" ? c.lines.correct_ar : c.lines.correct} ${explanation}`;
}

export function hintLine(c: Character, language: "en" | "ar", hint: string): string {
  return `${language === "ar" ? c.lines.wrong_ar : c.lines.wrong} ${hint}`;
}

/** After the second wrong try: the hint and then the answer. */
export function revealLine(explanation: string, hint: string): string {
  return `${hint} ${explanation}`;
}
