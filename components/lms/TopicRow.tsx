import Link from "next/link";
import type { Coverage, LessonState } from "@/lib/lms/coverage";

const STATE: Record<LessonState, { label: string; dot: string; text: string }> = {
  ready: { label: "written", dot: "bg-good", text: "text-good" },
  stale: { label: "old", dot: "bg-warn", text: "text-warn" },
  held: { label: "held", dot: "bg-bad", text: "text-bad" },
  missing: { label: "not written", dot: "bg-muted", text: "muted" },
};

function Pip({ state, level }: { state: LessonState; level: string }) {
  const s = STATE[state];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${s.text}`} title={`${level}: ${s.label}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {level}
    </span>
  );
}

/** One topic in the catalogue. The whole row opens it, because reading the material is the point of the page. */
export function TopicRow({ r }: { r: Coverage }) {
  return (
    <li>
      <Link href={`/parent/lms/${r.topic.id}`} className="block py-2 hover:bg-panel-2 rounded-xl px-1 -mx-1">
        <span className="flex items-start gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm truncate">{r.topic.name}</span>
            <span className="block text-xs muted truncate">
              {r.topic.subject}{r.topic.unit ? ` · ${r.topic.unit}` : ""} · {r.topic.language}
              {r.topic.grade !== null && ` · G${r.topic.grade}`}
              {r.topic.stream && ` · ${r.topic.stream}`}
            </span>
          </span>
          <span className="shrink-0 flex flex-col items-end gap-0.5">
            <span className="flex items-center gap-2">
              <Pip state={r.basics} level="basics" />
              <Pip state={r.advanced} level="deep" />
            </span>
            <span className="text-[11px] muted">
              {r.visuals > 0 ? `${r.visuals} diagram${r.visuals === 1 ? "" : "s"}` : "no diagrams"}
              {r.reviewedByHuman && " · signed off"}
            </span>
          </span>
          <span className="shrink-0 muted text-sm leading-6">›</span>
        </span>
        {(r.blocking.length > 0 || r.warnings.length > 0) && (
          <span className="block text-[11px] mt-0.5">
            {r.blocking.length > 0 && <span className="text-bad">held on: {r.blocking.join(", ")} </span>}
            {r.warnings.length > 0 && <span className="text-warn">warnings: {r.warnings.join(", ")}</span>}
          </span>
        )}
      </Link>
    </li>
  );
}
