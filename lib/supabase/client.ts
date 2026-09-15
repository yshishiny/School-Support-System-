"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser-side Supabase client, used for direct uploads to Storage (bypasses the server's body limit). */
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
