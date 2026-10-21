"use client";

import type { Monitor } from "@/types/monitor";
import { formatLatency } from "@/lib/status";
import { isDegradedLatency } from "@/lib/monitoring";
import { Heartbeats } from "@/components/dashboard/heartbeats";
import {
  CopyButton,
  ActionMenu,
  StatusBadge,
} from "@/components/dashboard/monitor-row-parts";
import { cn } from "@/lib/utils";

type MonitorsTableProps = {
  monitors: Monitor[];
  /** Ids of monitors with an in-flight manual check. */
  checkingIds: string[];
  /** True when a filter/search hides rows, so "empty" can say why. */
  isFiltered?: boolean;
  onSelect: (id: string) => void;
  onCheckNow: (id: string) => void;
  onEdit: (id: string) => void;
  onTogglePause: (id: string) => void;
  onDelete: (id: string) => void;
};

export function MonitorsTable({
  monitors,
  checkingIds,
  isFiltered = false,
  onSelect,
  onCheckNow,
  onEdit,
  onTogglePause,
  onDelete,
}: MonitorsTableProps) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-card/80 backdrop-blur-md"
      role="list"
      aria-label="Monitors"
    >
      {monitors.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {isFiltered
            ? "No monitors match your filters."
            : "No monitors yet. Add your first endpoint to start tracking uptime."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {monitors.map((monitor) => (
            <li key={monitor.id} role="listitem">
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(monitor.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(monitor.id);
                  }
                }}
                className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 sm:grid-cols-[minmax(14rem,18rem)_1fr_5rem_5.5rem_auto] lg:grid-cols-[minmax(16rem,20rem)_1fr_5rem_5.5rem_auto]"
                aria-label={`Open details for ${monitor.name}${monitor.paused ? " (paused)" : ""}`}
              >
                {/* Status + name + URL */}
                <div className="col-start-1 row-start-1 min-w-0 sm:col-span-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={monitor.status} />
                    {monitor.paused && (
                      <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">
                    {monitor.name}
                  </p>
                  <p className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                    <span className="truncate">{monitor.url}</span>
                    <CopyButton value={monitor.url} />
                  </p>
                </div>

                {/* Heartbeats: second row on phones, inline on larger screens. */}
                <div className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1 sm:justify-self-end lg:justify-self-start">
                  <Heartbeats
                    series={monitor.heartbeats}
                    status={monitor.status}
                  />
                </div>

                {/* Latency readout */}
                <div className="col-start-2 row-start-1 justify-self-end sm:col-start-3 lg:text-left">
                  <span
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      monitor.paused
                        ? "text-muted-foreground"
                        : monitor.responseTimeMs === null
                          ? "text-danger"
                          : isDegradedLatency(monitor.responseTimeMs)
                            ? "text-warning"
                            : "text-success",
                    )}
                  >
                    {formatLatency(monitor.responseTimeMs)}
                  </span>
                </div>

                {/* Interval badge */}
                <div className="hidden justify-self-end sm:col-start-4 sm:row-start-1 sm:block">
                  <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {monitor.interval}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-start-2 row-start-2 justify-self-end sm:col-start-5 sm:row-start-1">
                  <ActionMenu
                    paused={monitor.paused}
                    isChecking={checkingIds.includes(monitor.id)}
                    onCheckNow={() => onCheckNow(monitor.id)}
                    onEdit={() => onEdit(monitor.id)}
                    onTogglePause={() => onTogglePause(monitor.id)}
                    onDelete={() => onDelete(monitor.id)}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
