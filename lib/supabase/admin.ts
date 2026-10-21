import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * A server-only Supabase admin client authenticated with the service-role key.
 * This bypasses RLS and is used EXCLUSIVELY by trusted server-side background
 * work: the cron check runner and alert dispatch (which writes the system-owned
 * alert log after a verified check). It never acts on an arbitrary user id
 * supplied by a client.
 *
 * Never import this into client code.
 */
export function createAdminClient() {
  return createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
