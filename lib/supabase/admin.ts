import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * A server-only Supabase admin client authenticated with the service-role key.
 * This bypasses RLS and is used EXCLUSIVELY by the cron check runner, which
 * operates on behalf of the system rather than a signed-in user.
 *
 * Never import this into Server Components, Server Actions, or client code.
 */
export function createAdminClient() {
  return createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
