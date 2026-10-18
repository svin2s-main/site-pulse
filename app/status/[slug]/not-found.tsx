import { NotFoundNotice } from "@/components/not-found-notice";

/**
 * Defensive fallback for /status/[slug].
 *
 * The Proxy already answers unknown and unpublished slugs with a real 404, so
 * this renders only in the narrow case where the page ran anyway — a slug that
 * was unpublished between the Proxy check and the data fetch, or a transient
 * read error. The wording stays identical for "unknown" and "unpublished" so
 * unpublished slugs cannot be probed.
 */
export default function NotFound() {
  return (
    <NotFoundNotice
      title="Status page unavailable"
      description="This status page doesn't exist or isn't published. Check the link with whoever shared it."
    />
  );
}
