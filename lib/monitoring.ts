/**
 * Shared monitoring rules.
 *
 * The check runner (which writes a log row), the dashboard aggregation (which
 * computes uptime, latency and incidents) and the presentational mappers (which
 * colour the rows) all interpret the same check logs, so they must agree on what
 * counts as a success. Keeping the rules here guarantees a given log row is
 * classified identically everywhere.
 *
 * Intentionally free of Node/React-only APIs so it can be shared by the server
 * runner, Server Actions, and Client Components.
 */

/** `status_code` recorded when the request produced no HTTP response at all. */
export const NO_RESPONSE_STATUS_CODE = 0;

/** Latency (ms) above which a successful check is reported as degraded. */
export const SLOW_LATENCY_THRESHOLD_MS = 1000;

/** A check succeeded when the endpoint answered with a 2xx or 3xx status. */
export function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 400;
}

/**
 * A check failed on a timeout/network error (recorded as `0`) or any non-2xx/3xx
 * response — including 4xx, because a monitored endpoint that answers 404 is not
 * healthy even though it technically responded.
 */
export function isFailureStatus(statusCode: number): boolean {
  return !isSuccessStatus(statusCode);
}

/** A successful check slower than the threshold reads as degraded. */
export function isDegradedLatency(latencyMs: number): boolean {
  return latencyMs > SLOW_LATENCY_THRESHOLD_MS;
}

/**
 * A monitor is "pending" until it completes its first check.
 *
 * `monitors.status` defaults to `operational` on insert, so a monitor that has
 * never been checked would otherwise be indistinguishable from a healthy one.
 * `last_latency_ms` is set by every successful check and cleared when a check
 * fails, which makes `status = operational AND last_latency_ms IS NULL` exactly
 * the "never checked" state (a checked monitor that fails becomes `down`).
 */
export function isPendingMonitor(state: {
  status: string;
  last_latency_ms: number | null;
}): boolean {
  return state.status === "operational" && state.last_latency_ms === null;
}
