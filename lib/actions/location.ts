"use server";

import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PositionInput {
  lat: number;
  lng: number;
  acc: number | null;
}

/** Stores a position the phone gave us for a student action. Silently ignores bad input. */
export async function recordPositionAction(source: "checkin" | "prayer" | "manual", pos: PositionInput | null): Promise<void> {
  if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng) || Math.abs(pos.lat) > 90 || Math.abs(pos.lng) > 180) return;
  const { profile } = await requireStudent();
  const admin = createAdminClient();
  await admin.from("location_pings").insert({ user_id: profile.id, source, latitude: pos.lat, longitude: pos.lng, accuracy_m: pos.acc ?? null });
}
