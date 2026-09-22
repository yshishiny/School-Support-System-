/**
 * Telling a parent when they are uploading a file the app has already read.
 *
 * Six files were chosen for one child and five arrived, two of which the model titled "Story Settings
 * Description" although one was about a beach and the other a haunted house. The AI title is a description,
 * not an identity, and the stored file is a random UUID — so nothing in the app could answer "have I sent this
 * already?". The bytes can: a SHA-256 taken in the browser before the upload starts.
 *
 * A duplicate is reported, never refused. The same worksheet genuinely goes to two children, and re-sending a
 * file after deleting it is a legitimate thing to do. What must not happen is paying for a second AI read of a
 * file already understood, or a parent wondering why their list has two of something.
 */

export interface KnownFile {
  id: string;
  sha: string;
  studentId: string;
  title: string;
  createdAt: string;
  /** null when the file predates the column, which is most of them. */
  originalName: string | null;
}

export interface Candidate { name: string; sha: string; size: number }

export type Verdict =
  /** Nothing like it has been sent: upload and read it. */
  | { kind: "new"; name: string; sha: string }
  /** The same bytes are already on this child: skip the upload and the read entirely. */
  | { kind: "same_child"; name: string; sha: string; existing: KnownFile }
  /** The same bytes are on a sibling. Still worth uploading — it is this child's copy — but say so. */
  | { kind: "other_child"; name: string; sha: string; existing: KnownFile }
  /** Two files in this very batch are byte-identical. The first is kept, the rest are not sent twice. */
  | { kind: "twice_in_batch"; name: string; sha: string; firstName: string };

/**
 * What to do with each chosen file, in the order they were chosen.
 *
 * Within-batch duplicates are caught too: choosing the same file twice in one picker is easy to do on a phone
 * and produced two rows with no way to tell them apart.
 */
export function classify(files: Candidate[], known: KnownFile[], studentId: string): Verdict[] {
  const seen = new Map<string, string>(); // sha -> the name it was first chosen under
  return files.map((f) => {
    const first = seen.get(f.sha);
    if (first !== undefined) return { kind: "twice_in_batch", name: f.name, sha: f.sha, firstName: first };
    seen.set(f.sha, f.name);

    const mine = known.find((k) => k.sha === f.sha && k.studentId === studentId);
    if (mine) return { kind: "same_child", name: f.name, sha: f.sha, existing: mine };

    const theirs = known.find((k) => k.sha === f.sha);
    if (theirs) return { kind: "other_child", name: f.name, sha: f.sha, existing: theirs };

    return { kind: "new", name: f.name, sha: f.sha };
  });
}

/** The ones that actually need uploading: everything except a file this child already has. */
export function toUpload(verdicts: Verdict[]): Verdict[] {
  return verdicts.filter((v) => v.kind === "new" || v.kind === "other_child");
}

/** One line per file that is not being sent, in words a parent can act on. */
export function skipLine(v: Verdict, nameOfStudent: (id: string) => string): string | null {
  if (v.kind === "same_child") {
    const asName = v.existing.originalName && v.existing.originalName !== v.name ? ` (sent as “${v.existing.originalName}”)` : "";
    return `${v.name} — already here since ${v.existing.createdAt.slice(0, 10)} as “${v.existing.title}”${asName}. Not read again.`;
  }
  if (v.kind === "twice_in_batch") {
    return v.firstName === v.name
      ? `${v.name} — chosen twice. Sent once.`
      : `${v.name} — the same file as “${v.firstName}”. Sent once.`;
  }
  if (v.kind === "other_child") {
    return `${v.name} — ${nameOfStudent(v.existing.studentId)} already has this file. Sending this child their own copy.`;
  }
  return null;
}

/** Files the picker will not take, so the count can be stated instead of the extras vanishing. */
export function overCap(chosen: string[], cap: number): { taken: string[]; dropped: string[] } {
  return { taken: chosen.slice(0, cap), dropped: chosen.slice(cap) };
}
