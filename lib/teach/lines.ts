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
