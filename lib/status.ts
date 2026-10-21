import type { MonitorStatus } from "@/types/monitor";

export type StatusConfig = {
  label: string;
  dotClass: string;
  textClass: string;
  badgeClass: string;
  barClass: string;
};

export const STATUS_CONFIG: Record<MonitorStatus, StatusConfig> = {
  operational: {
    label: "Operational",
    dotClass: "bg-success",
    textClass: "text-success",
    badgeClass: "bg-success/10 text-success border-success/20",
    barClass: "bg-success",
  },
  degraded: {
    label: "Degraded",
    dotClass: "bg-warning",
    textClass: "text-warning",
    badgeClass: "bg-warning/10 text-warning border-warning/20",
    barClass: "bg-warning",
  },
  down: {
    label: "Down",
    dotClass: "bg-danger",
    textClass: "text-danger",
    badgeClass: "bg-danger/10 text-danger border-danger/20",
    barClass: "bg-danger",
  },
  // A monitor that has not completed its first check yet. Deliberately neutral:
  // it is neither healthy nor broken.
  pending: {
    label: "Pending",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
    badgeClass:
      "bg-muted text-muted-foreground border-muted-foreground/30",
    barClass: "bg-muted-foreground/40",
  },
};

export function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  return `${ms}ms`;
}

/**
 * Formats a timestamp in UTC. Check logs come from many locations and render on
 * both the server and the client, so a fixed time zone keeps the output stable
 * (a local-time format would differ between the two and break hydration).
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}
