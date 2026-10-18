import type { MonitorStatus } from "@/types/monitor";

/**
 * Types for the public status page feature.
 *
 * `StatusPageSummary` is the owner-facing shape (returned with the dashboard
 * data and from the save action); the `Public*` types are the read-only view
 * model rendered on the anonymous `/status/[slug]` page.
 */

export type StatusPageSummary = {
  slug: string;
  title: string;
  isLive: boolean;
};

/** Overall banner state on the public page. */
export type StatusPageOverall =
  | "empty"
  | "paused"
  | "pending"
  | "healthy"
  | "degraded"
  | "down";

export type PublicMonitorEntry = {
  id: string;
  name: string;
  status: MonitorStatus;
  paused: boolean;
  /** Uptime over the last 24h, e.g. "99.98"; "—" when there are no checks yet. */
  uptimePercentage: string;
};

export type PublicStatusPageData = {
  slug: string;
  title: string;
  overall: StatusPageOverall;
  monitors: PublicMonitorEntry[];
  /** Timestamp of the newest check shown, or null when nothing has been checked. */
  lastCheckedAt: string | null;
};
