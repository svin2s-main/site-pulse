"use client";

import { useState } from "react";
import {
  BellOff,
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  MonitorDot,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Monitor, UptimeRange } from "@/types/monitor";
import { STATUS_CONFIG, formatLatency } from "@/lib/status";
import { CheckLogs } from "@/components/dashboard/check-logs";
import { LatencyChart } from "@/components/dashboard/latency-chart";
import { CopyButton } from "@/components/dashboard/monitor-row-parts";
import { cn } from "@/lib/utils";

const RANGE_TABS: UptimeRange[] = ["24h", "7d", "30d"];

/**
 * Nearest-rank percentile over the already-filtered successful latencies.
 * Returns null for an empty series so the UI can print an explicit dash.
 */
function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index];
}

type MonitorDrawerProps = {
  monitor: Monitor | null;
  onClose: () => void;
  onCheckNow: (id: string) => void;
  isChecking: boolean;
};

export function MonitorDrawer({
  monitor,
  onClose,
  onCheckNow,
  isChecking,
}: MonitorDrawerProps) {
  return (
    <Dialog open={monitor !== null} onOpenChange={(open) => !open && onClose()}>
      {monitor && (
        <DrawerBody
          monitor={monitor}
          onCheckNow={onCheckNow}
          isChecking={isChecking}
        />
      )}
    </Dialog>
  );
}

function DrawerBody({
  monitor,
  onCheckNow,
  isChecking,
}: {
  monitor: Monitor;
  onCheckNow: (id: string) => void;
  isChecking: boolean;
}) {
  const [range, setRange] = useState<UptimeRange>("24h");
  const config = STATUS_CONFIG[monitor.status];
  const series = monitor.rangeSeries[range];
  const p50 = percentile(series, 50);
  const p95 = percentile(series, 95);

  return (
    <DialogContent>
      <div className="border-b border-border p-5">
        <div className="flex items-center gap-2 pr-8">
          <MonitorDot
            className={cn("size-4", config.textClass)}
            aria-hidden="true"
          />
          <DialogTitle className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
            {monitor.name}
          </DialogTitle>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              config.badgeClass,
            )}
          >
            {config.label}
          </span>
        </div>
        <DialogDescription className="mt-1 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
          <span className="truncate">{monitor.url}</span>
          <CopyButton value={monitor.url} />
        </DialogDescription>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            <Clock className="size-3" aria-hidden="true" />
            {monitor.interval}
          </span>

          {!monitor.alertsEnabled && (
            <span
              className="flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              title="Telegram alerts are disabled for this monitor"
            >
              <BellOff className="size-3" aria-hidden="true" />
              Alerts off
            </span>
          )}

          {/* `ssl_expires_at` is never populated yet, so the chip says so
              instead of claiming the certificate is expiring. */}
          {monitor.sslExpiresInDays === null ? (
            <span
              className="flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              title="TLS certificate expiry is not tracked yet"
            >
              <ShieldCheck className="size-3" aria-hidden="true" />
              SSL not tracked
            </span>
          ) : monitor.sslValid ? (
            <span className="flex items-center gap-1 rounded border border-success/20 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
              <ShieldCheck className="size-3" aria-hidden="true" />
              SSL Valid · Expires in {monitor.sslExpiresInDays} days
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded border border-danger/20 bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">
              <ShieldAlert className="size-3" aria-hidden="true" />
              SSL Expiring · {monitor.sslExpiresInDays} days
            </span>
          )}

          <span className="font-mono text-[10px] text-muted-foreground">
            Uptime{" "}
            {monitor.uptimePercentage === "—"
              ? "—"
              : `${monitor.uptimePercentage}%`}
          </span>

          <button
            type="button"
            onClick={() => onCheckNow(monitor.id)}
            disabled={isChecking || monitor.paused}
            title={
              monitor.paused
                ? "Resume the monitor to run checks"
                : "Run a check now"
            }
            className="flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isChecking ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-3" aria-hidden="true" />
            )}
            {isChecking ? "Checking..." : "Check now"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* Response time chart */}
        <section aria-label="Response time history">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Response Time
            </h3>
            <div
              className="flex rounded-md border border-border bg-muted p-0.5"
              role="tablist"
              aria-label="Time range"
            >
              {RANGE_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={range === tab}
                  onClick={() => setRange(tab)}
                  className={cn(
                    "rounded px-2 py-1 font-mono text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    range === tab
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
            <LatencyChart series={series} />
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
            <div className="flex gap-1">
              <dt>p50</dt>
              <dd className="text-foreground">{formatLatency(p50)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>p95</dt>
              <dd className="text-foreground">{formatLatency(p95)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>checks</dt>
              <dd className="text-foreground">{series.length}</dd>
            </div>
          </dl>
        </section>

        {/* Check logs */}
        <section className="mt-6" aria-label="Recent checks">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Checks
          </h3>
          <div className="mt-3">
            <CheckLogs logs={monitor.checkLogs} />
          </div>
        </section>
      </div>
    </DialogContent>
  );
}
