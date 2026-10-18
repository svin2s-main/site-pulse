"use client";

import { useState } from "react";
import {
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
import { STATUS_CONFIG } from "@/lib/status";
import { CheckLogs } from "@/components/dashboard/check-logs";
import { CopyButton } from "@/components/dashboard/monitor-row-parts";
import { cn } from "@/lib/utils";

const RANGE_TABS: UptimeRange[] = ["24h", "7d", "30d"];

type ResponseTimeChartProps = {
  series: number[];
};

/** SVG line chart with gradient fill over the selected range. */
function ResponseTimeChart({ series }: ResponseTimeChartProps) {
  if (series.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-zinc-500">
        No response data yet for this range.
      </p>
    );
  }

  const width = 448;
  const height = 96;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const step = series.length > 1 ? width / (series.length - 1) : 0;
  const path = series
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  const last = series[series.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-24 w-full"
        role="img"
        aria-label={`Response time trend, latest ${last}ms`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="rt-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#rt-fill)" />
        <path
          d={path}
          fill="none"
          stroke="#818cf8"
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-zinc-600">
        <span>min {min}ms</span>
        <span>max {max}ms</span>
        <span>latest {last}ms</span>
      </div>
    </div>
  );
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

  return (
    <DialogContent>
      <div className="border-b border-zinc-800 p-5">
        <div className="flex items-center gap-2 pr-8">
          <MonitorDot
            className={cn("size-4", config.textClass)}
            aria-hidden="true"
          />
          <DialogTitle className="text-base font-semibold text-zinc-100">
            {monitor.name}
          </DialogTitle>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
              config.badgeClass,
            )}
          >
            {config.label}
          </span>
        </div>
        <DialogDescription className="mt-1 flex items-center gap-1 font-mono text-[11px] text-zinc-500">
          <span className="truncate">{monitor.url}</span>
          <CopyButton value={monitor.url} />
        </DialogDescription>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            <Clock className="size-3" aria-hidden="true" />
            {monitor.interval}
          </span>

          {/* `ssl_expires_at` is never populated yet, so the chip says so
              instead of claiming the certificate is expiring. */}
          {monitor.sslExpiresInDays === null ? (
            <span
              className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500"
              title="TLS certificate expiry is not tracked yet"
            >
              <ShieldCheck className="size-3" aria-hidden="true" />
              SSL not tracked
            </span>
          ) : monitor.sslValid ? (
            <span className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
              <ShieldCheck className="size-3" aria-hidden="true" />
              SSL Valid · Expires in {monitor.sslExpiresInDays} days
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-500">
              <ShieldAlert className="size-3" aria-hidden="true" />
              SSL Expiring · {monitor.sslExpiresInDays} days
            </span>
          )}

          <span className="font-mono text-[10px] text-zinc-500">
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
            className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300 outline-none transition-colors hover:border-zinc-700 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Response Time
            </h3>
            <div
              className="flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5"
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
                    "rounded px-2 py-1 font-mono text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500",
                    range === tab
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <ResponseTimeChart series={monitor.rangeSeries[range]} />
          </div>
        </section>

        {/* Check logs */}
        <section className="mt-6" aria-label="Recent checks">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
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
