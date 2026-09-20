"use server";

import { revalidatePath } from "next/cache";
import { failed } from "@/lib/ops/fault";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseCoordinates } from "@/lib/places";

/** Address → coordinates through OpenStreetMap's Nominatim (free, one request per second). */
async function geocode(address: string): Promise<{ lat: number; lng: number; display: string } | null> {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`, {
    headers: { "User-Agent": "family-study-portal/1.0 (parent-configured places)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const hit = json[0];
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), display: hit.display_name } : null;
}

export async function addPlaceAction(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const { family } = await requireParent();
  const kind = String(formData.get("kind") ?? "other") as "home" | "school" | "other";
  const label = String(formData.get("label") ?? "").trim().slice(0, 60) || (kind === "home" ? "Home" : kind === "school" ? "School" : "Place");
  const where = String(formData.get("where") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "") || null;
  const radius = Math.max(50, Math.min(2000, Number(formData.get("radius_m") ?? 250) || 250));
  if (!where) return { error: "Paste coordinates, a Google Maps link, or type the address." };
  let coords = parseCoordinates(where);
  let address: string | null = null;
  if (!coords) {
    try {
      const g = await geocode(where);
      if (!g) return { error: "Could not find that address. Paste the coordinates from Google Maps instead (long-press the spot → copy the numbers)." };
      coords = { lat: g.lat, lng: g.lng };
      address = g.display;
    } catch (err) {
      return await failed("actions.places.addPlace.geocode", err, "The map service did not answer. Paste coordinates instead.");
    }
  } else {
    address = where.length < 120 ? where : null;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("places").insert({ family_id: family.id, student_id: kind === "home" ? null : studentId, kind, label, address, latitude: coords.lat, longitude: coords.lng, radius_m: radius });
  if (error) return failed("actions.places.addPlace", error);
  ["/parent/settings", "/parent"].forEach((p) => revalidatePath(p));
  return {};
}

export async function deletePlaceAction(id: string): Promise<void> {
  const { family } = await requireParent();
  const supabase = await createClient();
  await supabase.from("places").delete().eq("id", id).eq("family_id", family.id);
  ["/parent/settings", "/parent"].forEach((p) => revalidatePath(p));
}
