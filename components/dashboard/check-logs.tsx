import type { CheckLog } from "@/types/monitor";
import { formatLatency, formatTimestamp } from "@/lib/status";
import { cn } from "@/lib/utils";

type CheckLogsProps = {
  logs: CheckLog[];
};

export function CheckLogs({ logs }: CheckLogsProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-border px-3 py-8 text-center">
        <p className="text-xs text-muted-foreground">
          No checks recorded yet. Results appear after the first check runs.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[22rem] text-left text-xs">
        <caption className="sr-only">Recent health check log entries</caption>
        <thead>
          <tr className="border-b border-border bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
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
        <tbody className="divide-y divide-border font-mono text-[11px]">
          {logs.map((log) => {
            // statusCode 0 means a timeout / network failure — also an error.
            const isError = log.statusCode === 0 || log.statusCode >= 400;
            return (
              <tr key={log.id} className="text-foreground/80 odd:bg-muted/30">
                <td className="whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="px-2.5 py-1.5">
                  <span
                    className={cn(
                      "inline-block max-w-[14rem] truncate rounded px-1.5 py-0.5 align-bottom text-[10px] font-medium",
                      isError
                        ? "bg-danger/10 text-danger"
                        : "bg-success/10 text-success",
                    )}
                    title={`${log.statusCode} ${log.statusText}`}
                  >
                    {log.statusCode} {log.statusText}
                  </span>
                </td>
                <td
                  className={cn(
                    "px-2.5 py-1.5 text-right tabular-nums",
                    isError ? "text-muted-foreground" : "text-foreground/80",
                  )}
                >
                  {formatLatency(log.responseTimeMs)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-1.5 text-right text-muted-foreground">
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
