import Link from "next/link";
import { Activity } from "lucide-react";
import type { PublicStatusPageData, StatusPageOverall } from "@/types/status-page";
import { STATUS_CONFIG, formatTimestamp } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Presentational shell for the public, anonymous status page.
 *
 * Server-rendered and free of client state: everything it shows comes from
 * `loadPublicStatusPage`, which is bounded by the anonymous RLS policies. Only
 * names, statuses and a 24h uptime figure are rendered — never endpoint URLs or
 * raw error messages.
 */

const OVERALL_CONFIG: Record<
  StatusPageOverall,
  { label: string; className: string; dotClass: string }
> = {
  empty: {
    label: "No services yet",
    className: "border-zinc-800 bg-zinc-900 text-zinc-400",
    dotClass: "bg-zinc-500",
  },
  paused: {
    label: "All monitors paused",
    className: "border-zinc-800 bg-zinc-900 text-zinc-400",
    dotClass: "bg-zinc-500",
  },
  pending: {
    label: "Awaiting first check",
    className: "border-sky-500/20 bg-sky-500/10 text-sky-400",
    dotClass: "bg-sky-400",
  },
  healthy: {
    label: "All Systems Operational",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    dotClass: "bg-emerald-400",
  },
  degraded: {
    label: "Degraded Performance",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    dotClass: "bg-amber-400",
  },
  down: {
    label: "Service Disruption",
    className: "border-rose-500/20 bg-rose-500/10 text-rose-500",
    dotClass: "bg-rose-500",
  },
};

type PublicStatusPageProps = {
  page: PublicStatusPageData;
};

export function PublicStatusPage({ page }: PublicStatusPageProps) {
  const overall = OVERALL_CONFIG[page.overall];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-indigo-500">
          <Activity className="size-4 text-white" aria-hidden="true" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          DevPulse
        </span>
      </div>

      <header className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          {page.title}
        </h1>
        <div
          role="status"
          className={cn(
            "mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
            overall.className,
          )}
        >
          <span
            className={cn("size-2 rounded-full", overall.dotClass)}
            aria-hidden="true"
          />
          {overall.label}
        </div>
      </header>

      <section
        aria-label="Monitored services"
        className="mt-8 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80"
      >
        <h2 className="sr-only">Monitored services</h2>

        {page.monitors.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            No services are being monitored yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {page.monitors.map((monitor) => {
              const config = STATUS_CONFIG[monitor.status];

              return (
                <li
                  key={monitor.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-100">
                      {monitor.name}
                    </span>
                    {monitor.paused && (
                      <span className="rounded-full border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                        Paused
                      </span>
                    )}
                  </span>

                  <span className="flex items-center gap-3">
                    <span
                      className="font-mono text-xs tabular-nums text-zinc-400"
                      title="Uptime over the last 24 hours"
                    >
                      {monitor.uptimePercentage === "—"
                        ? "—"
                        : `${monitor.uptimePercentage}%`}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        config.badgeClass,
                      )}
                    >
                      <span
                        className={cn("size-1.5 rounded-full", config.dotClass)}
                        aria-hidden="true"
                      />
                      {config.label}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>
          {page.lastCheckedAt
            ? `Last check: ${formatTimestamp(page.lastCheckedAt)} UTC`
            : "No checks recorded yet."}
        </span>
        <Link
          href="/"
          className="rounded outline-none transition-colors hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Monitored with DevPulse
        </Link>
      </footer>
    </main>
  );
}
