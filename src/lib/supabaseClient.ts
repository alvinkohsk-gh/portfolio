import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured.");
    }
    client = createClient(url, anonKey);
  }
  return client;
}

/** A lazily-constructed singleton, so importing this module (e.g. via
 * layout.tsx -> AuthGate) never runs `createClient` - and can't throw on
 * missing env vars - until something actually calls into it. Everything
 * that does is inside a useEffect/event handler (see useAuthSync.ts,
 * auth.ts), which never runs during Next's server-side prerendering of the
 * page shell, only in the browser. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
