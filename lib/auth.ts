import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer for the current session.
 *
 * `getCurrentUser` is the one place that answers "who is signed in?". It uses
 * `auth.getUser()` (server-verified) — never `getSession()` — and redirects
 * anonymous visitors to /login instead of leaking an empty authenticated UI.
 */

export type SessionUser = {
  id: string;
  email: string | null;
};

export async function getCurrentUser(): Promise<SessionUser> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { id: user.id, email: user.email ?? null };
}
