import type { HeartbeatPoint, MonitorStatus } from "@/types/monitor";
import { STATUS_CONFIG } from "@/lib/status";
import { isDegradedLatency } from "@/lib/monitoring";
import { cn } from "@/lib/utils";

type HeartbeatBarProps = {
  point: HeartbeatPoint;
  status: MonitorStatus;
};

function HeartbeatBar({ point, status }: HeartbeatBarProps) {
  const failed = point.latency === null;
  // Same threshold the check runner uses to mark a check degraded, so an amber
  // bar always means "this check would be judged degraded".
  const isSlow = point.latency !== null && isDegradedLatency(point.latency);

  return (
    <span
      className={cn(
        "h-5 w-[3px] shrink-0 rounded-full transition-colors",
        failed
          ? "bg-danger"
          : isSlow
            ? "bg-warning"
            : STATUS_CONFIG[status].barClass,
      )}
    />
  );
}

type HeartbeatsProps = {
  series: HeartbeatPoint[];
  status: MonitorStatus;
};

export function Heartbeats({ series, status }: HeartbeatsProps) {
  if (series.length === 0) {
    return (
      <span className="text-[11px] text-muted-foreground">No checks yet</span>
    );
  }

  return (
    <div
      className="flex h-5 items-center gap-[2px] overflow-hidden"
      role="img"
      aria-label={`Last ${series.length} health checks: ${ariaSummary(series)}`}
    >
      {/* Newest first, matching the order the data arrives in. */}
      {series.map((point, index) => (
        <HeartbeatBar key={index} point={point} status={status} />
      ))}
    </div>
  );
}

function ariaSummary(series: HeartbeatPoint[]): string {
  const failures = series.filter((point) => point.latency === null).length;
  return `${series.length - failures} successful, ${failures} failed`;
}
