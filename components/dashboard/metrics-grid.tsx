import { Activity, Zap, Server, AlertTriangle } from "lucide-react";
import type { DashboardSummary } from "@/app/actions/monitors";
import { toUptimeDisplay, toLatencyDisplay } from "@/lib/mappers";

type MetricCardProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClass?: string;
  trend?: React.ReactNode;
};

function MetricCard({ label, value, icon, valueClass, trend }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 backdrop-blur-md transition-colors hover:border-zinc-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        <span className="text-zinc-600">{icon}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span
          className={`font-mono text-2xl font-semibold tracking-tight ${valueClass ?? "text-zinc-100"}`}
        >
          {value}
        </span>
        {trend}
      </div>
    </div>
  );
}

const TREND_NEUTRAL =
  "rounded-full border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400";
const TREND_GOOD =
  "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400";
const TREND_WARN =
  "rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400";

export function MetricsGrid({ summary }: { summary: DashboardSummary | null }) {
  const uptime = summary ? toUptimeDisplay(summary) : "—";
  const latency = summary ? toLatencyDisplay(summary.averageLatencyMs) : "—";
  const active = summary
    ? `${summary.operationalCount} / ${summary.totalCount} Operational`
    : "—";
  const incidents = summary
    ? `${summary.incidents24h} ${summary.incidents24h === 1 ? "Incident" : "Incidents"}`
    : "—";

  // The uptime and latency cards are labelled "Last 24h" because that is the
  // window the aggregation actually uses.
  const activeTrend = (() => {
    if (!summary) return { label: "—", className: TREND_NEUTRAL };
    if (summary.incidents24h > 0) {
      return { label: "Issue detected", className: TREND_WARN };
    }
    if (summary.pendingCount > 0) {
      return { label: "Awaiting first check", className: TREND_NEUTRAL };
    }
    return { label: "All good", className: TREND_GOOD };
  })();

  const incidentsTrend = (() => {
    if (!summary) return { label: "—", className: TREND_NEUTRAL };
    if (summary.incidents24h === 0) {
      return { label: "Quiet day", className: TREND_GOOD };
    }
    return { label: "Issue detected", className: TREND_WARN };
  })();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Overall Uptime"
        value={uptime}
        icon={<Activity className="size-4" aria-hidden="true" />}
        valueClass="text-emerald-400"
        trend={<span className={TREND_NEUTRAL}>Last 24h</span>}
      />
      <MetricCard
        label="Average Latency"
        value={latency}
        icon={<Zap className="size-4" aria-hidden="true" />}
        valueClass="text-amber-400"
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
        trend={
          <span className={incidentsTrend.className}>{incidentsTrend.label}</span>
        }
      />
    </div>
  );
}
