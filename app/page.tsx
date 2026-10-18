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
    <div className="min-h-screen bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <div className="h-7 w-32 animate-pulse rounded-md bg-zinc-800" />
        <div className="flex-1" />
        <div className="h-8 w-48 animate-pulse rounded-md bg-zinc-800" />
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/80"
            />
          ))}
        </div>
        <div className="h-16 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/80" />
        <div className="h-16 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/80" />
      </div>
    </div>
  );
}
