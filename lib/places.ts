/** Named places and where a position falls: home, school, or "elsewhere, x km from home". */
export interface Place {
  id?: string;
  kind: "home" | "school" | "other";
  label: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  student_id?: string | null;
}

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export interface PlaceMatch {
  label: string; // "Home", "School", "1.8 km from home", "unknown area"
  kind: "home" | "school" | "other" | "away";
  distanceM: number | null;
}

/** Nearest place within its radius wins; otherwise distance from home (or the nearest place). */
export function classifyPosition(lat: number, lng: number, places: Place[], studentId?: string | null, accuracyM: number | null = null): PlaceMatch {
  const mine = places.filter((p) => !p.student_id || p.student_id === studentId);
  if (mine.length === 0) return { label: "no places set", kind: "away", distanceM: null };
  const slack = Math.min(accuracyM ?? 0, 300);
  const ranked = mine.map((p) => ({ p, d: distanceM(lat, lng, p.latitude, p.longitude) })).sort((a, b) => a.d - b.d);
  const hit = ranked.find((r) => r.d <= r.p.radius_m + slack);
  if (hit) return { label: hit.p.label, kind: hit.p.kind, distanceM: hit.d };
  const home = ranked.find((r) => r.p.kind === "home") ?? ranked[0];
  const km = home.d / 1000;
  return { label: `${km < 10 ? km.toFixed(1) : Math.round(km)} km from ${home.p.label.toLowerCase()}`, kind: "away", distanceM: home.d };
}

/** Parses "30.0444, 31.2357", a Google Maps link with @lat,lng or q=lat,lng, else null. */
export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const t = text.trim();
  const m = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/.exec(t) ?? /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(t);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
