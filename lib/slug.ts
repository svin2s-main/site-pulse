/**
 * Shared rules for public status-page slugs.
 *
 * The slug appears in a public URL (`/status/<slug>`) and is stored in
 * `public_status_pages.slug`, whose CHECK constraint enforces the same pattern.
 * Keeping the rule here means the Server Action, the form, and the database all
 * agree on what a valid slug looks like.
 */

/** Kebab-case: lowercase alphanumerics separated by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 50;

/**
 * Slugs that would be confusing or that collide with application routes.
 * (Routing itself is namespaced under `/status/`, so this is about clarity and
 * avoiding impersonation rather than path collisions.)
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "dashboard",
  "devpulse",
  "login",
  "new",
  "settings",
  "signup",
  "status",
  "support",
  "www",
]);

/**
 * Suggests a default slug from the signed-in user's email so the form opens
 * with something usable: "dana.k@acme.dev" → "dana-k".
 */
export function suggestStatusPageSlug(email: string | null): string {
  const local = (email ?? "").split("@")[0] ?? "";
  const slug = local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH);

  if (slug.length < SLUG_MIN_LENGTH || RESERVED_SLUGS.has(slug)) {
    return "my-status";
  }

  return slug;
}
