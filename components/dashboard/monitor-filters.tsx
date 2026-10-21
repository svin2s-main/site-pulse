"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MonitorStatusFilter =
  | "all"
  | "operational"
  | "degraded"
  | "down"
  | "pending"
  | "paused";

export type MonitorSort = "name" | "latency" | "uptime";

const STATUS_OPTIONS: { value: MonitorStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "operational", label: "Operational" },
  { value: "degraded", label: "Degraded" },
  { value: "down", label: "Down" },
  { value: "pending", label: "Pending" },
  { value: "paused", label: "Paused" },
];

const SORT_OPTIONS: { value: MonitorSort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "latency", label: "Latency" },
  { value: "uptime", label: "Uptime" },
];

export function isMonitorStatusFilter(
  value: unknown,
): value is MonitorStatusFilter {
  return (
    typeof value === "string" &&
    STATUS_OPTIONS.some((option) => option.value === value)
  );
}

export function isMonitorSort(value: unknown): value is MonitorSort {
  return (
    typeof value === "string" &&
    SORT_OPTIONS.some((option) => option.value === value)
  );
}

type MonitorFiltersProps = {
  query: string;
  onQueryChange: (query: string) => void;
  status: MonitorStatusFilter;
  onStatusChange: (status: MonitorStatusFilter) => void;
  sort: MonitorSort;
  onSortChange: (sort: MonitorSort) => void;
  resultCount: number;
  totalCount: number;
};

/**
 * Client-side filtering for the monitor list. The list is small (one page of a
 * single account's monitors), so filtering and sorting run in memory; the
 * selection is mirrored to the URL by the parent for shareable links.
 */
export function MonitorFilters({
  query,
  onQueryChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  resultCount,
  totalCount,
}: MonitorFiltersProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by name or URL..."
            aria-label="Search monitors"
            className="h-8 w-full rounded-md border border-input bg-card pl-8 pr-8 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Clear search"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="monitor-sort"
            className="text-[11px] font-medium text-muted-foreground"
          >
            Sort
          </label>
          <select
            id="monitor-sort"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as MonitorSort)}
            className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-muted-foreground sm:ml-2">
            {resultCount}/{totalCount}
          </span>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter monitors by status"
      >
        {STATUS_OPTIONS.map((option) => {
          const isActive = status === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onStatusChange(option.value)}
              aria-pressed={isActive}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
