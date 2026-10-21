/**
 * Formats how long ago `timestampMs` was, for "live" dashboard labels.
 *
 * Pure and deterministic: callers pass `nowMs` so the value can be derived
 * during render once per tick instead of reading the clock in many places.
 */
export function formatRelativeTime(timestampMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round((nowMs - timestampMs) / 1000));

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
