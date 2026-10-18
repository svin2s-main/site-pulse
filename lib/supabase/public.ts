import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * A cookie-less, anonymous Supabase client for public (unauthenticated) reads.
 *
 * Used by the `/status/[slug]` route so the page never depends on a session:
 * it relies purely on the `anon` RLS policies, which only expose rows belonging
 * to a user who has a **live** status page. Because it never touches cookies,
 * it also keeps the route free of session state.
 *
 * The publishable/anon key is a client identifier, not a secret — RLS is the
 * authorization boundary.
 */
export function createPublicClient() {
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
