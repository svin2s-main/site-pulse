"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DashboardSummary } from "@/app/actions/monitors";
import {
  toggleMonitorPauseAction,
  deleteMonitorAction,
  checkMonitorNowAction,
  getDashboardDataAction,
} from "@/app/actions/monitors";
import type { Monitor } from "@/types/monitor";
import { toDashboardMonitor } from "@/lib/mappers";
import { Header } from "@/components/dashboard/header";
import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { MonitorsTable } from "@/components/dashboard/monitors-table";
import {
  MonitorFilters,
  isMonitorSort,
  isMonitorStatusFilter,
  type MonitorSort,
  type MonitorStatusFilter,
} from "@/components/dashboard/monitor-filters";
import { MonitorDrawer } from "@/components/dashboard/monitor-drawer";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { StatusPageSettings } from "@/components/dashboard/status-page-settings";
import { TelegramSettingsCard } from "@/components/dashboard/telegram-settings";
import { MonitorFormDialog } from "@/components/dashboard/monitor-form-dialog";
import { suggestStatusPageSlug } from "@/lib/slug";
import type { StatusPageSummary } from "@/types/status-page";
import type { TelegramSettings } from "@/types/alerts";

/** Background refresh cadence while the tab is visible. */
const REFRESH_INTERVAL_MS = 30_000;

/** How often the relative "updated Ns ago" label re-renders. */
const CLOCK_TICK_MS = 10_000;

type DashboardProps = {
  initialMonitors: Monitor[];
  initialSummary: DashboardSummary | null;
  initialStatusPage: StatusPageSummary | null;
  initialTelegram: TelegramSettings;
  userEmail: string | null;
  loadError: string | null;
};

/** "99.98" → 99.98; "—" sorts last. */
function uptimeValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? -1 : parsed;
}

export function Dashboard({
  initialMonitors,
  initialSummary,
  initialStatusPage,
  initialTelegram,
  userEmail,
  loadError,
}: DashboardProps) {
  const [monitors, setMonitors] = useState<Monitor[]>(initialMonitors);
  // The log-derived metrics (uptime, latency, incidents) only move when new
  // checks run, so they come from the server. The counts below are recomputed
  // from the live list instead.
  const [summaryBase, setSummaryBase] = useState<DashboardSummary | null>(
    initialSummary,
  );
  const [statusPage, setStatusPage] = useState<StatusPageSummary | null>(
    initialStatusPage,
  );
  const [telegram, setTelegram] = useState<TelegramSettings>(initialTelegram);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Filters are client-side: one account's monitors fit comfortably in memory.
  // The initial values come from the URL so a filtered view can be shared.
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams?.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<MonitorStatusFilter>(() => {
    const value = searchParams?.get("status");
    return isMonitorStatusFilter(value) ? value : "all";
  });
  const [sort, setSort] = useState<MonitorSort>(() => {
    const value = searchParams?.get("sort");
    return isMonitorSort(value) ? value : "name";
  });

  // "Live" indicator state.
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInFlight = useRef(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Mirror every filter change back into the URL for shareable links.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (sort !== "name") params.set("sort", sort);

    const search = params.toString();
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ""}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [query, statusFilter, sort]);

  // Relative timestamps need to age even when no data changes.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (refreshInFlight.current) return;

    refreshInFlight.current = true;
    setIsRefreshing(true);

    try {
      const result = await getDashboardDataAction();
      if (!result.success) return;

      setMonitors(
        result.data.monitors.map(({ monitor, recentLogs }) =>
          toDashboardMonitor(monitor, recentLogs),
        ),
      );
      setSummaryBase(result.data.summary);
      setStatusPage(result.data.statusPage);
      setTelegram(result.data.telegram);
      setLastUpdatedAt(Date.now());
    } catch {
      // A transient background failure must not wipe the last good data.
    } finally {
      refreshInFlight.current = false;
      setIsRefreshing(false);
    }
  }, []);

  // Background refresh: only while the tab is visible, never overlapping.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_INTERVAL_MS);

    const handleVisibility = (): void => {
      if (document.visibilityState === "visible") void refresh();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  /**
   * Counts that depend on the live list are derived here rather than kept in
   * state, so add / delete / edit / pause / check-now are always reflected
   * without manual counter bookkeeping.
   */
  const summary = useMemo<DashboardSummary | null>(() => {
    if (!summaryBase) return null;

    const active = monitors.filter((monitor) => !monitor.paused);

    return {
      ...summaryBase,
      totalCount: monitors.length,
      activeCount: active.length,
      pendingCount: active.filter((monitor) => monitor.status === "pending")
        .length,
      operationalCount: active.filter(
        (monitor) => monitor.status === "operational",
      ).length,
    };
  }, [summaryBase, monitors]);

  const visibleMonitors = useMemo<Monitor[]>(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = monitors.filter((monitor) => {
      if (
        normalizedQuery &&
        !`${monitor.name} ${monitor.url}`
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        return false;
      }

      if (statusFilter === "all") return true;
      if (statusFilter === "paused") return monitor.paused;
      if (monitor.paused) return false;
      return monitor.status === statusFilter;
    });

    const sorted = [...filtered];
    switch (sort) {
      case "latency":
        sorted.sort(
          (a, b) =>
            (a.responseTimeMs ?? Number.POSITIVE_INFINITY) -
            (b.responseTimeMs ?? Number.POSITIVE_INFINITY),
        );
        break;
      case "uptime":
        sorted.sort(
          (a, b) =>
            uptimeValue(b.uptimePercentage) - uptimeValue(a.uptimePercentage),
        );
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sorted;
  }, [monitors, query, statusFilter, sort]);

  const isFiltered = query.trim() !== "" || statusFilter !== "all";

  const applyMonitor = useCallback((updated: Monitor): void => {
    setMonitors((current) => {
      const exists = current.some((monitor) => monitor.id === updated.id);
      return exists
        ? current.map((monitor) =>
            monitor.id === updated.id ? updated : monitor,
          )
        : [...current, updated];
    });
  }, []);

  const handleCheckNow = useCallback(async (id: string): Promise<void> => {
    setActionError(null);
    setCheckingIds((current) => [...current, id]);

    try {
      const result = await checkMonitorNowAction(id);

      if (!result.success) {
        setActionError(result.error);
        return;
      }

      // The action returns the refreshed dashboard, so replace client state
      // with server truth (the new log row, status, and recomputed metrics).
      setMonitors(
        result.data.monitors.map(({ monitor, recentLogs }) =>
          toDashboardMonitor(monitor, recentLogs),
        ),
      );
      setSummaryBase(result.data.summary);
      setStatusPage(result.data.statusPage);
      setTelegram(result.data.telegram);
      setLastUpdatedAt(Date.now());
    } finally {
      setCheckingIds((current) => current.filter((value) => value !== id));
    }
  }, []);

  const handleTogglePause = useCallback(
    async (id: string): Promise<void> => {
      setActionError(null);
      // Optimistically flip locally, then reconcile with the server result.
      const target = monitors.find((monitor) => monitor.id === id);
      if (!target) return;

      setMonitors((current) =>
        current.map((monitor) =>
          monitor.id === id ? { ...monitor, paused: !monitor.paused } : monitor,
        ),
      );

      const result = await toggleMonitorPauseAction(id);
      if (result.success) {
        // Only patch the pause flag: a background refresh may have replaced the
        // rest of this monitor's data while the action was in flight.
        setMonitors((current) =>
          current.map((monitor) =>
            monitor.id === id
              ? { ...monitor, paused: result.data.is_paused }
              : monitor,
          ),
        );
      } else {
        // Roll back on failure.
        setActionError(result.error);
        setMonitors((current) =>
          current.map((monitor) =>
            monitor.id === id
              ? { ...monitor, paused: target.paused }
              : monitor,
          ),
        );
      }
    },
    [monitors],
  );

  const handleDelete = useCallback(
    async (id: string): Promise<void> => {
      setActionError(null);
      const deleted = monitors.find((monitor) => monitor.id === id);
      if (!deleted) return;

      // Optimistically remove, then confirm.
      setMonitors((current) => current.filter((monitor) => monitor.id !== id));
      setSelectedId((current) => (current === id ? null : current));
      setEditingId((current) => (current === id ? null : current));

      const result = await deleteMonitorAction(id);
      if (!result.success) {
        // Restore on failure.
        setActionError(result.error);
        setMonitors((current) =>
          [...current, deleted].sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
    },
    [monitors],
  );

  const selectedMonitor = useMemo(
    () => monitors.find((monitor) => monitor.id === selectedId) ?? null,
    [monitors, selectedId],
  );

  const editingMonitor = useMemo(
    () => monitors.find((monitor) => monitor.id === editingId) ?? null,
    [monitors, editingId],
  );

  const errorMessage = loadError ?? actionError;

  return (
    <div className="min-h-screen bg-background">
      <Header
        summary={summary}
        userEmail={userEmail}
        lastUpdatedAt={lastUpdatedAt}
        now={now}
        isRefreshing={isRefreshing}
        onRefresh={() => {
          void refresh();
        }}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onAddMonitor={() => setAddOpen(true)}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        {errorMessage && (
          <p
            role="alert"
            className="rounded-md border border-warning/20 bg-warning/10 px-3 py-2 text-xs font-medium text-warning"
          >
            {errorMessage}
          </p>
        )}

        <MetricsGrid summary={summary} />

        <section aria-label="Monitors">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Monitors</h2>
            <span className="font-mono text-[11px] text-muted-foreground">
              {monitors.filter((monitor) => !monitor.paused).length} active
            </span>
          </div>

          <div className="mb-3">
            <MonitorFilters
              query={query}
              onQueryChange={setQuery}
              status={statusFilter}
              onStatusChange={setStatusFilter}
              sort={sort}
              onSortChange={setSort}
              resultCount={visibleMonitors.length}
              totalCount={monitors.length}
            />
          </div>

          <MonitorsTable
            monitors={visibleMonitors}
            checkingIds={checkingIds}
            isFiltered={isFiltered}
            onSelect={setSelectedId}
            onCheckNow={handleCheckNow}
            onEdit={setEditingId}
            onTogglePause={handleTogglePause}
            onDelete={handleDelete}
          />
        </section>

        <TelegramSettingsCard
          settings={telegram}
          onSettingsChange={setTelegram}
        />

        <StatusPageSettings
          statusPage={statusPage}
          defaultSlug={suggestStatusPageSlug(userEmail)}
          monitorCount={monitors.length}
          onSaved={setStatusPage}
        />
      </main>

      <MonitorDrawer
        monitor={selectedMonitor}
        onClose={() => setSelectedId(null)}
        onCheckNow={handleCheckNow}
        isChecking={
          selectedMonitor !== null && checkingIds.includes(selectedMonitor.id)
        }
      />
      {paletteOpen && (
        <CommandPalette
          open
          monitors={monitors}
          onClose={() => setPaletteOpen(false)}
          onSelectMonitor={setSelectedId}
        />
      )}
      <MonitorFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={applyMonitor}
      />
      <MonitorFormDialog
        open={editingMonitor !== null}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
        monitor={editingMonitor}
        onSaved={applyMonitor}
      />
    </div>
  );
}
