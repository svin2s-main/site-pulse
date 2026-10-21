import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SLUG_PATTERN } from "@/lib/slug";

/**
 * Proxy (the Next.js 16 name for middleware) runs before every matched request.
 *
 * Responsibilities:
 *  1. Serve public status pages, including their 404s (see below).
 *  2. Refresh the Supabase auth session so Server Components / Actions /
 *     Route Handlers always see a valid access token.
 *  3. Redirect anonymous visitors away from protected pages (fast 307 + no
 *     flash). This is a UX convenience, NOT the authorization boundary — the
 *     real check lives in `lib/auth.ts` and every Server Action.
 *
 * Reference: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
 */

/** Pages that require a signed-in user. Extend as the app grows. */
const PROTECTED_PATHS = ["/"];

/** Public, anonymous status pages live under `/status/<slug>`. */
const PUBLIC_STATUS_PREFIX = "/status/";

/**
 * Rewrite target for an unknown or unpublished status slug. It is deliberately a
 * path with **no matching route**, so the router renders `app/not-found.tsx`,
 * and passing `status: 404` on the rewrite makes the response a real 404.
 *
 * Why the check can't live in the page: with Cache Components every route is
 * partially prerendered, so a page-level `notFound()` runs *after* the shell —
 * and its `200` status — is already on the wire. Next.js documents the Proxy
 * pre-check as the way to return a real 404 for a request-time condition.
 *
 * @see node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md
 * @see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md (Status codes)
 */
const NOT_FOUND_REWRITE_PATH = "/404";

/**
 * Cheap existence probe against the unique `slug` index, using RLS:
 * `public_status_pages` is only readable by `anon` when `is_live` is true, so
 * unpublished pages are indistinguishable from unknown ones.
 *
 * Built inline rather than importing the shared Supabase helpers: the Proxy docs
 * explicitly warn against depending on shared application modules.
 */
async function isStatusPageLive(slug: string): Promise<boolean> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabase
    .from("public_status_pages")
    .select("slug")
    .eq("slug", slug)
    .eq("is_live", true)
    .maybeSingle();

  // Fail open: a transient Supabase error must not 404 a page that is probably
  // fine. The page then re-checks and renders its own fallback.
  if (error) return true;

  return data !== null;
}

async function handleStatusPage(request: NextRequest) {
  const rawSlug = request.nextUrl.pathname
    .slice(PUBLIC_STATUS_PREFIX.length)
    .replace(/\/+$/, "");

  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    // Malformed percent-encoding: not a slug we ever issued.
    slug = "";
  }

  if (!SLUG_PATTERN.test(slug) || !(await isStatusPageLive(slug))) {
    return NextResponse.rewrite(
      new URL(NOT_FOUND_REWRITE_PATH, request.url),
      { status: 404 },
    );
  }

  return NextResponse.next();
}

/** System endpoints authenticate with their own shared secrets, not cookies. */
const SYSTEM_ENDPOINTS = new Set([
  "/api/cron/check",
  "/api/telegram/webhook",
]);

export async function proxy(request: NextRequest) {
  // Public status pages need no session, so they are handled before any auth
  // work: this skips a pointless `getUser()` round trip per page view.
  if (request.nextUrl.pathname.startsWith(PUBLIC_STATUS_PREFIX)) {
    return handleStatusPage(request);
  }

  // Machine-to-machine endpoints must not depend on the Supabase auth service
  // being reachable; their route handlers verify their own secrets.
  if (SYSTEM_ENDPOINTS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Keep the incoming request in sync, then rebuild the response so the
          // refreshed cookies are written upstream via Set-Cookie.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: calling getUser() triggers the token refresh. Do not add logic
  // between creating the client and this call, or you risk hard-to-debug
  // random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && PROTECTED_PATHS.includes(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";

    const redirectResponse = NextResponse.redirect(loginUrl);
    // Preserve any refreshed auth cookies on the redirect response.
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every path except:
     * - _next/static, _next/image  (build/image assets)
     * - favicon.ico and other static files with an extension
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
