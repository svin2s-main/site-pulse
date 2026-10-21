import { formatLatency } from "@/lib/status";

type LatencyChartProps = {
  series: number[];
};

/**
 * Lightweight SVG line chart for response times.
 *
 * Deliberately dependency-free: the series is at most a few dozen points, so a
 * plain polyline is smaller and faster than a charting library, and the colours
 * come from the theme tokens (`--primary`).
 */
export function LatencyChart({ series }: LatencyChartProps) {
  if (series.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        No response data yet for this range.
      </p>
    );
  }

  const width = 448;
  const height = 96;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const step = series.length > 1 ? width / (series.length - 1) : 0;
  const path = series
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  const last = series[series.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-24 w-full"
        role="img"
        aria-label={`Response time trend over ${series.length} checks, latest ${last}ms, minimum ${min}ms, maximum ${max}ms`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="latency-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--primary)"
              stopOpacity="0.35"
            />
            <stop
              offset="100%"
              stopColor="var(--primary)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#latency-fill)" />
        <path
          d={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>min {formatLatency(min)}</span>
        <span>max {formatLatency(max)}</span>
        <span>latest {formatLatency(last)}</span>
      </div>
    </div>
  );
}
