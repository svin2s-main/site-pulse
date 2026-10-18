import { NotFoundNotice } from "@/components/not-found-notice";

/**
 * App-wide 404 boundary.
 *
 * Reached in two ways:
 *  1. Any URL that matches no route.
 *  2. A status slug that is unknown or unpublished — the Proxy rewrites those
 *     here with `status: 404`, because a page-level `notFound()` can only answer
 *     `200` once the prerendered shell has already streamed. See `proxy.ts`.
 */
export default function NotFound() {
  return (
    <NotFoundNotice
      title="Page not found"
      description="The page you're looking for doesn't exist, or a status page with that link isn't published."
    />
  );
}
