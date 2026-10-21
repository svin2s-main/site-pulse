import { Activity, Zap, Server, AlertTriangle } from "lucide-react";
import type { DashboardSummary } from "@/app/actions/monitors";
import { toUptimeDisplay, toLatencyDisplay } from "@/lib/mappers";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClass?: string;
  trend?: React.ReactNode;
};

function MetricCard({ label, value, icon, valueClass, trend }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card/80 p-4 backdrop-blur-md transition-colors hover:border-ring/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground/70">{icon}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span
          className={cn(
            "font-mono text-2xl font-semibold tracking-tight",
            valueClass ?? "text-foreground",
          )}
        >
          {value}
        </span>
        {trend}
      </div>
    </div>
  );
}

const TREND_NEUTRAL =
  "rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground";
const TREND_GOOD =
  "rounded-full border border-success/20 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success";
const TREND_WARN =
  "rounded-full border border-warning/20 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning";

export function MetricsGrid({ summary }: { summary: DashboardSummary | null }) {
  const uptime = summary ? toUptimeDisplay(summary) : "—";
  const latency = summary ? toLatencyDisplay(summary.averageLatencyMs) : "—";
  // Active / total is the headline; the operational breakdown moves into the
  // trend badge so the value never has to wrap on a phone.
  const active = summary
    ? `${summary.activeCount} / ${summary.totalCount}`
    : "—";
  const incidents = summary ? String(summary.incidents24h) : "—";

  // The uptime and latency cards are labelled "Last 24h" because that is the
  // window the aggregation actually uses.
  const activeTrend = (() => {
    if (!summary) return { label: "—", className: TREND_NEUTRAL };
    if (summary.activeCount === 0) {
      return { label: "All paused", className: TREND_NEUTRAL };
    }
    if (summary.incidents24h > 0) {
      return {
        label: `${summary.activeCount - summary.operationalCount} not operational`,
        className: TREND_WARN,
      };
    }
    if (summary.pendingCount > 0) {
      return {
        label: `${summary.pendingCount} awaiting check`,
        className: TREND_NEUTRAL,
      };
    }
    return { label: "All operational", className: TREND_GOOD };
  })();

  const incidentsTrend = (() => {
    if (!summary) return { label: "—", className: TREND_NEUTRAL };
    if (summary.incidents24h === 0) {
      return { label: "Quiet day", className: TREND_GOOD };
    }
    return { label: "Needs review", className: TREND_WARN };
  })();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Overall Uptime"
        value={uptime}
        icon={<Activity className="size-4" aria-hidden="true" />}
        valueClass="text-success"
        trend={<span className={TREND_NEUTRAL}>Last 24h</span>}
      />
      <MetricCard
        label="Average Latency"
        value={latency}
        icon={<Zap className="size-4" aria-hidden="true" />}
        valueClass="text-warning"
        trend={<span className={TREND_NEUTRAL}>Last 24h</span>}
      />
      <MetricCard
        label="Active Monitors"
        value={active}
        icon={<Server className="size-4" aria-hidden="true" />}
        trend={
          <span className={activeTrend.className}>{activeTrend.label}</span>
        }
      />
      <MetricCard
        label="Incidents (Last 24h)"
        value={incidents}
        icon={<AlertTriangle className="size-4" aria-hidden="true" />}
        valueClass={summary && summary.incidents24h > 0 ? "text-danger" : undefined}
        trend={
          <span className={incidentsTrend.className}>{incidentsTrend.label}</span>
        }
      />
    </div>
  );
}
