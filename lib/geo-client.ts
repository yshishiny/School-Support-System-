"use client";

export interface Position {
  lat: number;
  lng: number;
  acc: number | null;
}

/** Asks the phone for its position, once, with a short timeout. Resolves null when denied or unavailable. */
export function getPosition(timeoutMs = 8000): Promise<Position | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    const done = (p: Position | null) => resolve(p);
    const t = setTimeout(() => done(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(t); done({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null }); },
      () => { clearTimeout(t); done(null); },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 },
    );
  });
}
