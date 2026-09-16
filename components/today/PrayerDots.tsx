import type { PrayerRow } from "@/components/PrayerPill";

const LETTER: Record<string, string> = { fajr: "F", dhuhr: "D", asr: "A", maghrib: "M", isha: "I" };

/** Five dots: filled green on time, amber late, outlined accent when the window is open, grey otherwise. */
export function PrayerDots({ rows, size = 26 }: { rows: PrayerRow[]; size?: number }) {
  return (
    <div className="flex gap-2">
      {rows.map((r) => {
        const cls = r.logged === "on_time" ? "bg-good text-bg" : r.logged === "late" ? "bg-warn text-bg" : r.logged === "missed" ? "bg-bad text-bg" : r.state === "open" ? "border-2 border-accent text-accent-2 pulse" : "border-2 border-line text-muted";
        return (
          <div key={r.prayer} title={`${r.prayer} ${r.time}`} className={`rounded-full flex items-center justify-center text-[10px] font-extrabold ${cls}`} style={{ width: size, height: size }}>
            {LETTER[r.prayer]}
          </div>
        );
      })}
    </div>
  );
}
