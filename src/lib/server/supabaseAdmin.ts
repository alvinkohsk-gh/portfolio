import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Service-role client for server-only routes that must read/write across
 * every account (e.g. the digest cron) - bypasses Row Level Security
 * entirely, unlike the anon-key client in supabaseClient.ts that every
 * page uses. SUPABASE_SERVICE_ROLE_KEY is deliberately not prefixed
 * NEXT_PUBLIC_, so it's only ever available server-side and is never sent
 * to the browser. Only import this from route handlers, never from a
 * "use client" file. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are not configured.");
    }
    client = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
