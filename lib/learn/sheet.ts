/**
 * One school file, opened by the child it was given to.
 *
 * Until now a file was a row with an "Open" link that left the app for a raw PDF in a browser tab, and — only
 * if somebody had remembered to transcribe it — a button somewhere underneath. The file itself, what it is
 * about, the questions on it and the two ways to finish it were four different places, and the title, the one
 * thing a child would actually tap, was dead text.
 *
 * This decides what one file offers, so the page can put those things in one place and in a sensible order.
 * The ordering claim is small but worth stating: **the teacher's own questions come before anything the app
 * invents.** Practice generated from a sheet is useful, and it is not the homework.
 */

export type Route = "answer" | "waiting" | "practise" | "paper";

export interface SheetFile {
  mime: string;
  /** Questions transcribed off the sheet, ready to sit. */
  questions: number;
  /** The reader found questions on it. False for notes, a syllabus, a letter home. */
  hasQuestions: boolean;
  /** Why the last transcription attempt produced nothing, if it did. */
  error: string | null;
  /** Practice sets already built from this file. */
  sets: number;
  /** The reader's study version of the content; without it there is nothing to build practice from. */
  hasDigest: boolean;
}

/** How to put the file in front of a child without sending him out of the app. */
export function viewerFor(mime: string): "pdf" | "image" | "link" {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  // Word, Excel, CSV and plain text have no viewer a phone browser will render inline. The reader's own study
  // version of the content is shown instead, and the file stays one tap away.
  return "link";
}

/**
 * What this file offers, best first.
 *
 * `waiting` and `answer` are mutually exclusive: a sheet either has its questions or is having them made.
 * `paper` is always offered, because a sheet the app cannot transcribe is still a sheet he has to hand in, and
 * that was the case with nowhere to go.
 */
export function routesOf(f: SheetFile): Route[] {
  const out: Route[] = [];
  if (f.questions > 0) out.push("answer");
  else if (f.hasQuestions) out.push("waiting");
  if (f.hasDigest) out.push("practise");
  out.push("paper");
  return out;
}

/**
 * The one line at the top of the page, addressed to the child.
 *
 * It says what to do, not what the file is — he can see what the file is, it is on the screen underneath.
 */
export function headlineOf(f: SheetFile, sat: number): string {
  if (f.questions > 0) {
    return sat > 0
      ? `You have answered this ${sat === 1 ? "once" : `${sat} times`}. ${f.questions} question${f.questions === 1 ? "" : "s"} — go again to push the mark up.`
      : `${f.questions} question${f.questions === 1 ? "" : "s"} from this sheet, ready to answer here.`;
  }
  if (f.hasQuestions) {
    return f.error
      ? "The questions on this sheet could not be read. Do it on paper and photograph it, and it will still be marked."
      : "The questions on this sheet are being typed up now. Practise from it meanwhile, or do it on paper.";
  }
  if (f.sets > 0) return `Nothing to answer on this one — it is for reading. ${f.sets} practice set${f.sets === 1 ? "" : "s"} built from it.`;
  return "Nothing to answer on this one — it is for reading. Make practice from it when you want to test yourself.";
}

/**
 * Whether to put the file itself above the things to do with it.
 *
 * On a sheet with questions the child is here to answer it, so the buttons lead and the sheet sits under them
 * for reference. On a letter home or a page of notes there is nothing to answer, reading *is* the task, and
 * making him scroll past three buttons to reach the only thing that matters would be the old bug in a new
 * place.
 */
export function sheetFirst(f: SheetFile): boolean {
  return f.questions === 0 && !f.hasQuestions;
}

/** What each route's button says and why it is there. */
export function labelOf(r: Route): { label: string; hint: string } {
  switch (r) {
    case "answer":
      return { label: "📝 Answer the sheet", hint: "The teacher's own questions, typed up. No printing." };
    case "waiting":
      return { label: "⏳ Questions on the way", hint: "Being typed up from the sheet. It takes about a minute." };
    case "practise":
      return { label: "⚡ Practise from it", hint: "New questions on the same material, as many rounds as you want." };
    case "paper":
      return { label: "📷 I did it on paper", hint: "Photograph what you wrote. You will be told where it first goes wrong — not the answer." };
  }
}
