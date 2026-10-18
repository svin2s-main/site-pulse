"use client";

import { useState } from "react";
import { Search, Activity } from "lucide-react";
import type { Monitor } from "@/types/monitor";
import { STATUS_CONFIG } from "@/lib/status";
import { cn } from "@/lib/utils";

type CommandPaletteProps = {
  open: boolean;
  monitors: Monitor[];
  onClose: () => void;
  onSelectMonitor: (id: string) => void;
};

export function CommandPalette({
  open,
  monitors,
  onClose,
  onSelectMonitor,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const results = normalizedQuery
    ? monitors.filter((monitor) =>
        `${monitor.name} ${monitor.url}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : monitors;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[15vh] backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50 outline-none"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3.5 py-3">
          <Search className="size-4 text-zinc-500" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "Enter" && results[0]) {
                onSelectMonitor(results[0].id);
                onClose();
              }
            }}
            placeholder="Search monitors, endpoints, actions..."
            className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
          />
          <kbd className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            ESC
          </kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-sm text-zinc-500">
              No monitors match “{query}”
            </p>
          ) : (
            results.map((monitor) => (
              <button
                key={monitor.id}
                type="button"
                onClick={() => {
                  onSelectMonitor(monitor.id);
                  onClose();
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left outline-none transition-colors hover:bg-zinc-800 focus-visible:bg-zinc-800"
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    STATUS_CONFIG[monitor.status].dotClass,
                  )}
                  aria-hidden="true"
                />
                <Activity
                  className="size-3.5 shrink-0 text-zinc-500"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-200">
                    {monitor.name}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-zinc-500">
                    {monitor.url}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
