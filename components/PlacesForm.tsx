"use client";

import { useActionState } from "react";
import { addPlaceAction, deletePlaceAction } from "@/lib/actions/places";
import { Notice, SubmitButton } from "./ui";

export interface PlaceRow {
  id: string;
  kind: "home" | "school" | "other";
  label: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_m: number;
  student_id: string | null;
}

export function PlacesForm({ places, students }: { places: PlaceRow[]; students: { id: string; full_name: string }[] }) {
  const [state, action] = useActionState(addPlaceAction, undefined);
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="h2">📍 Home and school</h2>
        <p className="text-xs muted">With these set, "last seen" says Home, School, or how far from home. Paste coordinates or a Google Maps link (long-press the spot in Maps → copy), or type the address.</p>
      </div>
      {places.length > 0 && (
        <ul className="divide-y divide-line text-sm">
          {places.map((p) => (
            <li key={p.id} className="py-1.5 flex items-center gap-2">
              <span>{p.kind === "home" ? "🏠" : p.kind === "school" ? "🏫" : "📌"}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{p.label}{p.student_id ? ` · ${students.find((s) => s.id === p.student_id)?.full_name.split(" ")[0] ?? ""}` : ""} <span className="muted font-normal text-xs">· {p.radius_m} m</span></div>
                <div className="text-xs muted truncate">{p.address ?? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}</div>
              </div>
              <a href={`https://maps.google.com/?q=${p.latitude},${p.longitude}`} target="_blank" rel="noreferrer" className="text-xs underline muted">map</a>
              <form action={deletePlaceAction.bind(null, p.id)}><button className="text-xs muted hover:text-bad">remove</button></form>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="grid gap-2 sm:grid-cols-2">
        <select name="kind" className="input"><option value="home">🏠 Home</option><option value="school">🏫 School</option><option value="other">📌 Other (club, grandparents…)</option></select>
        <select name="student_id" className="input"><option value="">Both kids</option>{students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
        <input name="label" className="input" placeholder="Label (e.g. KIS, Grandma)" maxLength={60} />
        <input name="radius_m" type="number" className="input" placeholder="Radius in metres (250)" min={50} max={2000} />
        <input name="where" className="input sm:col-span-2" placeholder="30.0444, 31.2357 · or a Google Maps link · or the address" required />
        <SubmitButton className="btn-primary sm:col-span-2" pendingText="Finding it…">Add place</SubmitButton>
      </form>
      <Notice error={state?.error} />
    </section>
  );
}
