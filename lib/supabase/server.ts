import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Server-side Supabase client for Server Components, Server Actions, and Route
 * Handlers. Follows the @supabase/ssr cookie-handling contract: `getAll` reads
 * the async `cookies()` store and `setAll` writes session updates back.
 *
 * Always create a fresh client per request; never share across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` call was made from a Server Component that cannot
            // write cookies. This is safe to ignore, as the middleware /
            // proxy refreshes auth tokens before reaching here.
          }
        },
      },
    },
  );
}
