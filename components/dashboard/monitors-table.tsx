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
  onSelect: (id: string) => void;
  onCheckNow: (id: string) => void;
  onEdit: (id: string) => void;
  onTogglePause: (id: string) => void;
  onDelete: (id: string) => void;
};

export function MonitorsTable({
  monitors,
  checkingIds,
  onSelect,
  onCheckNow,
  onEdit,
  onTogglePause,
  onDelete,
}: MonitorsTableProps) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 backdrop-blur-md"
      role="list"
      aria-label="Monitors"
    >
      {monitors.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-zinc-500">
          No monitors yet. Add your first endpoint to start tracking uptime.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800/80">
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
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 outline-none transition-colors hover:bg-zinc-800/40 focus-visible:bg-zinc-800/40 sm:grid-cols-[minmax(14rem,18rem)_1fr_5rem_auto] lg:grid-cols-[minmax(16rem,20rem)_1fr_5rem_5.5rem_auto] cursor-pointer"
                aria-label={`Open details for ${monitor.name}${monitor.paused ? " (paused)" : ""}`}
              >
                {/* Status + name + URL */}
                <div className="col-span-3 min-w-0 sm:col-span-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={monitor.status} />
                    {monitor.paused && (
                      <span className="rounded-full border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-zinc-100">
                    {monitor.name}
                  </p>
                  <p className="flex items-center gap-1 font-mono text-[11px] text-zinc-500">
                    <span className="truncate">{monitor.url}</span>
                    <CopyButton value={monitor.url} />
                  </p>
                </div>

                {/* Heartbeats */}
                <div className="col-span-2 min-w-0 sm:col-span-1 sm:justify-self-end lg:justify-self-start">
                  <Heartbeats series={monitor.heartbeats} status={monitor.status} />
                </div>

                {/* Latency readout */}
                <div className="col-span-1 text-right lg:text-left">
                  <span
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      monitor.responseTimeMs === null
                        ? "text-rose-500"
                        : isDegradedLatency(monitor.responseTimeMs)
                          ? "text-amber-400"
                          : "text-emerald-400",
                    )}
                  >
                    {formatLatency(monitor.responseTimeMs)}
                  </span>
                </div>

                {/* Interval badge */}
                <div className="col-span-1 hidden justify-self-end sm:block">
                  <span className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                    {monitor.interval}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-1 justify-self-end">
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
