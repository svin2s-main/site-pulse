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
    dotClass: "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]",
    textClass: "text-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    barClass: "bg-emerald-500",
  },
  degraded: {
    label: "Degraded",
    dotClass: "bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.5)]",
    textClass: "text-amber-400",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    barClass: "bg-amber-400",
  },
  down: {
    label: "Down",
    dotClass: "bg-rose-500 shadow-[0_0_6px_2px_rgba(244,63,94,0.5)]",
    textClass: "text-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    barClass: "bg-rose-500",
  },
  // A monitor that has not completed its first check yet. Deliberately neutral:
  // it is neither healthy nor broken.
  pending: {
    label: "Pending",
    dotClass: "bg-zinc-400",
    textClass: "text-zinc-400",
    badgeClass: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    barClass: "bg-zinc-700",
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
