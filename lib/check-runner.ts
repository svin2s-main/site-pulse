import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CheckInterval,
  Database,
  MonitorStatus,
} from "@/lib/database.types";
import {
  NO_RESPONSE_STATUS_CODE,
  isDegradedLatency,
  isFailureStatus,
} from "@/lib/monitoring";

type MonitorRow = Database["public"]["Tables"]["monitors"]["Row"];

/**
 * Any Supabase client can run checks: the admin (service-role) client for the
 * cron runner, or a request-scoped client for a user-triggered manual check.
 * RLS still applies when the latter is used, so a user can only write their own
 * rows even without an explicit `user_id` filter.
 */
export type DbClient = SupabaseClient<Database>;

export const CHECK_LOCATIONS = [
  "US-East",
  "US-West",
  "EU-Central",
  "AP-Southeast",
] as const;

const DEFAULT_TIMEOUT_MS = 10_000;

/** Hostnames that must never be reachable from the check runner (SSRF guard). */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
]);

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost"];

/**
 * Refuses loopback, link-local, and private-network targets.
 *
 * The monitor URL is user-supplied, so without this the runner could be used to
 * probe the host's internal network. Only literal hosts are covered here; a
 * public name that resolves to a private address (DNS rebinding) is not, which
 * is a documented limitation.
 */
function isBlockedUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  // IPv6 loopback, unique-local (fc00::/7) and link-local (fe80::/10).
  if (host === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(host)) return true;

  return false;
}

type CheckOutcome = {
  statusCode: number | null;
  latencyMs: number;
  location: string;
  errorMessage: string | null;
};

async function runSingleCheck(monitor: MonitorRow): Promise<CheckOutcome> {
  const location = CHECK_LOCATIONS[0] ?? "US-East";

  if (isBlockedUrl(monitor.url)) {
    return {
      statusCode: null,
      latencyMs: 0,
      location,
      errorMessage: "Refused to check a private or local address",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(monitor.url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "DevPulse-Monitor/1.0" },
      cache: "no-store",
    });
    // Some servers reject HEAD; fall back to a GET for a definitive answer.
    if (response.status === 405 || response.status === 501) {
      const get = await fetch(monitor.url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "DevPulse-Monitor/1.0" },
        cache: "no-store",
      });
      return {
        statusCode: get.status,
        latencyMs: Date.now() - startedAt,
        location,
        errorMessage: null,
      };
    }
    return {
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
      location,
      errorMessage: null,
    };
  } catch (error) {
    return {
      statusCode: null,
      latencyMs: Date.now() - startedAt,
      location,
      errorMessage:
        error instanceof Error ? error.message : "Request failed or timed out",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function inferStatus(outcome: CheckOutcome): MonitorStatus {
  // No response (timeout / network error / blocked target) is a failure, as is
  // any non-2xx/3xx status — see `@/lib/monitoring`.
  if (outcome.statusCode === null) return "down";
  if (isFailureStatus(outcome.statusCode)) return "down";
  if (isDegradedLatency(outcome.latencyMs)) return "degraded";
  return "operational";
}

function intervalToDelayMs(interval: CheckInterval): number {
  const seconds: Record<CheckInterval, number> = {
    "30s": 30,
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
  };
  return seconds[interval] * 1000;
}

function isDue(monitor: MonitorRow, now: number): boolean {
  // `updated_at` is bumped on every check by the monitors trigger, so it acts
  // as the "last checked" timestamp. A monitor is due when its interval has
  // elapsed since the last update.
  return Date.parse(monitor.updated_at) + intervalToDelayMs(monitor.interval) <= now;
}

export type CheckOptions = {
  /** Run even when the monitor is not yet due — used by the manual check. */
  force?: boolean;
  now?: number;
};

/**
 * Runs a health check for a single monitor and persists the outcome. Returns
 * whether the monitor was processed by this call.
 */
export async function checkMonitor(
  monitor: MonitorRow,
  client: DbClient,
  options: CheckOptions = {},
): Promise<boolean> {
  const { force = false, now = Date.now() } = options;

  if (monitor.is_paused) return false;
  if (!force && !isDue(monitor, now)) return false;

  const outcome = await runSingleCheck(monitor);
  const status = inferStatus(outcome);

  // A request that never produced a response has no meaningful latency.
  const latencyMs =
    outcome.statusCode === null ? 0 : Math.max(0, outcome.latencyMs);

  const [updateResult, logResult] = await Promise.all([
    client
      .from("monitors")
      .update({
        status,
        last_latency_ms: status === "down" ? null : latencyMs,
      })
      .eq("id", monitor.id),
    client.from("check_logs").insert({
      monitor_id: monitor.id,
      status_code: outcome.statusCode ?? NO_RESPONSE_STATUS_CODE,
      latency_ms: latencyMs,
      location: outcome.location,
      error_message: outcome.errorMessage,
    }),
  ]);

  if (updateResult.error || logResult.error) {
    // Surface a lower-severity representative error; still report processed.
    const detail = (updateResult.error ?? logResult.error)?.message;
    throw new Error(`Failed to persist check: ${detail ?? "unknown error"}`);
  }

  return true;
}

/**
 * Runs health checks for a list of monitors using the given client (admin for
 * the cron runner, request-scoped for a user-triggered manual check).
 */
export async function runChecksForMonitors(
  monitors: MonitorRow[],
  client: DbClient,
): Promise<{ checked: number }> {
  let checked = 0;
  for (const monitor of monitors) {
    try {
      if (await checkMonitor(monitor, client)) {
        checked += 1;
      }
    } catch (error) {
      // Isolate per-monitor failures so one bad endpoint cannot stop the run.
      console.error("Check failed for monitor", monitor.id, error);
    }
  }
  return { checked };
}
