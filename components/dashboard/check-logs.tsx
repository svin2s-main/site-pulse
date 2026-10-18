import type { CheckLog } from "@/types/monitor";
import { formatLatency, formatTimestamp } from "@/lib/status";
import { cn } from "@/lib/utils";

type CheckLogsProps = {
  logs: CheckLog[];
};

export function CheckLogs({ logs }: CheckLogsProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 px-3 py-8 text-center">
        <p className="text-xs text-zinc-500">
          No checks recorded yet. Results appear after the first check runs.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Recent health check log entries</caption>
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80 text-[10px] uppercase tracking-wider text-zinc-500">
            <th scope="col" className="px-2.5 py-1.5 font-medium">
              Timestamp (UTC)
            </th>
            <th scope="col" className="px-2.5 py-1.5 font-medium">
              Status
            </th>
            <th scope="col" className="px-2.5 py-1.5 text-right font-medium">
              Time
            </th>
            <th scope="col" className="px-2.5 py-1.5 text-right font-medium">
              Location
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/80 font-mono text-[11px]">
          {logs.map((log) => {
            // statusCode 0 means a timeout / network failure — also an error.
            const isError = log.statusCode === 0 || log.statusCode >= 400;
            return (
              <tr key={log.id} className="text-zinc-300 odd:bg-zinc-900/40">
                <td className="px-2.5 py-1.5 text-zinc-400">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="px-2.5 py-1.5">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium",
                      isError
                        ? "bg-rose-500/10 text-rose-500"
                        : "bg-emerald-500/10 text-emerald-400",
                    )}
                  >
                    {log.statusCode} {log.statusText}
                  </span>
                </td>
                <td
                  className={cn(
                    "px-2.5 py-1.5 text-right tabular-nums",
                    isError ? "text-zinc-500" : "text-zinc-300",
                  )}
                >
                  {formatLatency(log.responseTimeMs)}
                </td>
                <td className="px-2.5 py-1.5 text-right text-zinc-400">
                  {log.location}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
