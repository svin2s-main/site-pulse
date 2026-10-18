"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardSummary } from "@/app/actions/monitors";
import {
  toggleMonitorPauseAction,
  deleteMonitorAction,
  checkMonitorNowAction,
} from "@/app/actions/monitors";
import type { Monitor } from "@/types/monitor";
import { toDashboardMonitor } from "@/lib/mappers";
import { Header } from "@/components/dashboard/header";
import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { MonitorsTable } from "@/components/dashboard/monitors-table";
import { MonitorDrawer } from "@/components/dashboard/monitor-drawer";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { StatusPageSettings } from "@/components/dashboard/status-page-settings";
import { MonitorFormDialog } from "@/components/dashboard/monitor-form-dialog";
import { suggestStatusPageSlug } from "@/lib/slug";
import type { StatusPageSummary } from "@/types/status-page";

type DashboardProps = {
  initialMonitors: Monitor[];
  initialSummary: DashboardSummary | null;
  initialStatusPage: StatusPageSummary | null;
  userEmail: string | null;
  loadError: string | null;
};

export function Dashboard({
  initialMonitors,
  initialSummary,
  initialStatusPage,
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

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
        applyMonitor({ ...target, paused: result.data.is_paused });
      } else {
        // Roll back on failure.
        setActionError(result.error);
        applyMonitor(target);
      }
    },
    [applyMonitor, monitors],
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
    <div className="min-h-screen bg-zinc-950">
      <Header
        summary={summary}
        userEmail={userEmail}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onAddMonitor={() => setAddOpen(true)}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        {errorMessage && (
          <p
            role="alert"
            className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400"
          >
            {errorMessage}
          </p>
        )}

        <MetricsGrid summary={summary} />

        <section aria-label="Monitors">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Monitors</h2>
            <span className="font-mono text-[11px] text-zinc-500">
              {monitors.filter((monitor) => !monitor.paused).length} active
            </span>
          </div>
          <MonitorsTable
            monitors={monitors}
            checkingIds={checkingIds}
            onSelect={setSelectedId}
            onCheckNow={handleCheckNow}
            onEdit={setEditingId}
            onTogglePause={handleTogglePause}
            onDelete={handleDelete}
          />
        </section>

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
