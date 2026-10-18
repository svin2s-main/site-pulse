import type { CheckInterval } from "@/lib/database.types";

export type MonitorStatus = "operational" | "degraded" | "down" | "pending";

export type HeartbeatPoint = {
  /** Latency in milliseconds; null = failed check (downtime). */
  latency: number | null;
};

export type CheckLog = {
  id: string;
  timestamp: string;
  statusCode: number;
  statusText: string;
  responseTimeMs: number;
  location: string;
};

export type UptimeRange = "24h" | "7d" | "30d";

export type Monitor = {
  id: string;
  name: string;
  url: string;
  status: MonitorStatus;
  /** Latest response time in ms; null when down or not yet checked. */
  responseTimeMs: number | null;
  /** Uptime over recent checks, e.g. "99.98"; "—" when there is no data yet. */
  uptimePercentage: string;
  /** Raw check interval value as stored in the database (e.g. "1m"). */
  interval: CheckInterval;
  paused: boolean;
  heartbeats: HeartbeatPoint[];
  /** Days until the TLS certificate expires; null when tracking is unavailable. */
  sslExpiresInDays: number | null;
  /** null when SSL expiry is not tracked for this monitor. */
  sslValid: boolean | null;
  rangeSeries: Record<UptimeRange, number[]>;
  checkLogs: CheckLog[];
};
