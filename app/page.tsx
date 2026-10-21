import { Suspense } from "react";
import { DashboardLoader } from "@/components/dashboard/dashboard-loader";

export default function Home() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardLoader />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 border-b border-border px-4 sm:px-6">
        <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
        <div className="hidden h-5 w-36 animate-pulse rounded-full bg-muted sm:block" />
        <div className="flex-1" />
        <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
        <div className="hidden h-8 w-32 animate-pulse rounded-md bg-muted sm:block" />
        <div className="size-8 animate-pulse rounded-md bg-muted" />
        <div className="size-7 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-lg border border-border bg-card/80"
            />
          ))}
        </div>
        <div className="h-8 w-full max-w-md animate-pulse rounded-md bg-muted" />
        <div className="h-16 animate-pulse rounded-lg border border-border bg-card/80" />
        <div className="h-16 animate-pulse rounded-lg border border-border bg-card/80" />
        <div className="h-16 animate-pulse rounded-lg border border-border bg-card/80" />
        <div className="h-28 animate-pulse rounded-lg border border-border bg-card/80" />
      </div>
    </div>
  );
}
