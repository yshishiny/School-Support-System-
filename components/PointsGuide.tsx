import { POINTS } from "@/lib/points";
import { PRAYER_POINTS } from "@/lib/prayers";
import { QUIZ_POINTS } from "@/lib/learning";

/** How points are earned and the fastest daily routine. Shown to the boys. */
export function PointsGuide({ compact = false }: { compact?: boolean }) {
  const perfectDay =
    POINTS.CHECKIN +
    POINTS.LESSON_NOTE * POINTS.LESSON_NOTE_MAX +
    POINTS.ALL_DONE_BONUS +
    PRAYER_POINTS.ON_TIME * 5 +
    PRAYER_POINTS.ALL_ON_TIME_BONUS +
    QUIZ_POINTS.DAILY_CAP;
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="h2">🏆 How to win points fast</h2>
        <span className="badge text-accent-2">up to ~{perfectDay}+ a day</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Tile emoji="✅" title="Daily check-in" pts={`+${POINTS.CHECKIN}`} note="every evening, honest answers" />
        <Tile emoji="📖" title="Lesson notes" pts={`+${POINTS.LESSON_NOTE} × ${POINTS.LESSON_NOTE_MAX}`} note="one line per class you had" />
        <Tile emoji="📝" title="Homework on time" pts={`+${POINTS.HOMEWORK_ON_TIME} each`} note={`late +${POINTS.HOMEWORK_LATE}, all done +${POINTS.ALL_DONE_BONUS}`} />
        <Tile emoji="🕌" title="Prayers on time" pts={`+${PRAYER_POINTS.ON_TIME} × 5`} note={`all five on time +${PRAYER_POINTS.ALL_ON_TIME_BONUS}`} />
        <Tile emoji="🧠" title="Practice sets" pts={`+${QUIZ_POINTS.COMPLETE} +1/correct`} note={`80%+ adds +${QUIZ_POINTS.HIGH_SCORE_BONUS}, max ${QUIZ_POINTS.DAILY_CAP}/day`} />
        <Tile emoji="🔥" title="Streaks" pts="+20 / +50 / +100 / +250" note="3, 7, 14, 30 days in a row" />
      </div>

      {!compact && (
        <div className="rounded-xl bg-panel-2 p-3 text-sm space-y-1">
          <div className="font-semibold">⚡ The fast routine (about 40 minutes)</div>
          <ol className="list-decimal pl-5 space-y-1 muted">
            <li>Log each prayer the moment you pray it. Five on time is <b className="text-ink">+25</b> without studying.</li>
            <li>After school: one practice set on today's hardest class, <b className="text-ink">+10 to +20</b>.</li>
            <li>Evening: check-in with one line per class and homework marked, <b className="text-ink">+10 +10 +15</b>.</li>
            <li>Then the recall quiz on today's lessons, and the review queue if it has questions, <b className="text-ink">+10 to +20</b>.</li>
            <li>Never skip a day: streak bonuses are the biggest single payouts.</li>
          </ol>
          <p className="text-xs muted pt-1">Cheating does not pay: sets answered impossibly fast or with the tab switched earn 0 and show on Dad's page.</p>
        </div>
      )}
    </section>
  );
}

function Tile({ emoji, title, pts, note }: { emoji: string; title: string; pts: string; note: string }) {
  return (
    <div className="rounded-xl border border-line p-2.5">
      <div className="flex items-center justify-between">
        <span>{emoji} <b>{title}</b></span>
        <span className="text-accent-2 font-bold whitespace-nowrap">{pts}</span>
      </div>
      <div className="text-xs muted mt-0.5">{note}</div>
    </div>
  );
}
