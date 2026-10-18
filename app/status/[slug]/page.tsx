import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicStatusPage } from "@/lib/public-status-page";
import { PublicStatusPage } from "@/components/status/public-status-page";

/**
 * Public, anonymous status page: /status/<slug>
 *
 * Read-only. The slug is resolved against live pages only, and an unknown or
 * unpublished slug renders the segment's `not-found` page (no distinction is
 * made between the two, so unpublished slugs cannot be probed).
 *
 * `noindex` is intentional: a status page is meant to be shared with customers
 * by link, not discovered by search engines.
 */

/**
 * Deliberately a *blocking* route. With `cacheComponents` enabled, a route that
 * reads `params` and hits the database outside a `<Suspense>` boundary must opt
 * out of instant-navigation validation (otherwise the build fails with
 * "encountered uncached or runtime data during prerendering").
 *
 * There is intentionally no `loading.tsx` here: a status page should paint its
 * real content rather than a skeleton flash, which matters most exactly when
 * customers are checking it during an incident.
 *
 * Unknown and unpublished slugs never reach this component — `proxy.ts`
 * answers them with a real 404 before rendering.
 *
 * @see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md
 */
export const instant = false;

interface StatusPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: StatusPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPublicStatusPage(slug);

  if (!page) {
    return {
      title: "Status page unavailable — DevPulse",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${page.title} — DevPulse`,
    description: `Live availability and uptime for ${page.title}.`,
    robots: { index: false, follow: false },
  };
}

export default async function StatusPage({ params }: StatusPageProps) {
  const { slug } = await params;
  // `loadPublicStatusPage` is wrapped in React's `cache`, so this shares the
  // single database round trip with `generateMetadata`.
  const page = await loadPublicStatusPage(slug);

  if (!page) {
    notFound();
  }

  return <PublicStatusPage page={page} />;
}
