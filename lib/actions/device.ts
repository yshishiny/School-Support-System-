"use server";

import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DeviceInfo {
  platform: string;       // "Android", "iOS", "Windows", "macOS", "Linux", "other"
  standalone: boolean;    // opened from the installed app (home-screen icon / APK) rather than a browser tab
  ua: string;
  screen: string;         // "412x915@2.6"
  language: string;
  timezone: string;
  battery: number | null; // 0..100
  charging: boolean | null;
  connection: string | null; // "4g", "wifi", "slow-2g"…
  source: string | null;  // ?source=app|shortcut when launched from the icon
}

/** Once per session from the browser: the device dimension for this person. */
export async function reportDeviceAction(info: DeviceInfo): Promise<void> {
  const { profile } = await requireSession();
  const admin = createAdminClient();
  const device = { ...info, ua: info.ua.slice(0, 300), updated_at: new Date().toISOString() };
  const patch: Record<string, unknown> = { device };
  if (info.standalone && !(profile as { app_installed_at?: string | null }).app_installed_at) patch.app_installed_at = new Date().toISOString();
  await admin.from("profiles").update(patch).eq("id", profile.id);
}
