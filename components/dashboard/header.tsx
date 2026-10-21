"use client";

import { useTransition } from "react";
import {
  Activity,
  CircleUser,
  Command,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import type { DashboardSummary } from "@/app/actions/monitors";
import { signOutAction } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatRelativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type HeaderProps = {
  summary: DashboardSummary | null;
  userEmail: string | null;
  /** Epoch ms of the last successful background refresh. */
  lastUpdatedAt: number;
  /** Epoch ms used to render the relative "updated Ns ago" label. */
  now: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenCommandPalette: () => void;
  onAddMonitor: () => void;
};

/** "dana.k@acme.dev" → "DK"; falls back to the first two characters. */
function initialsFromEmail(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[.\-_+]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

type PillState = "empty" | "paused" | "pending" | "healthy" | "attention";

const PILL: Record<
  PillState,
  {
    label: string;
    /** Compact label for phones, where the full label would not fit. */
    shortLabel: string;
    className: string;
    dotClass: string;
    ping: boolean;
  }
> = {
  empty: {
    label: "No monitors yet",
    shortLabel: "Empty",
    className: "border-border bg-card text-muted-foreground",
    dotClass: "bg-muted-foreground",
    ping: false,
  },
  paused: {
    label: "All monitors paused",
    shortLabel: "Paused",
    className: "border-border bg-card text-muted-foreground",
    dotClass: "bg-muted-foreground",
    ping: false,
  },
  pending: {
    label: "Awaiting first check",
    shortLabel: "Pending",
    className: "border-info/20 bg-info/10 text-info",
    dotClass: "bg-info",
    ping: false,
  },
  healthy: {
    label: "All Systems Operational",
    shortLabel: "Healthy",
    className: "border-success/20 bg-success/10 text-success",
    dotClass: "bg-success",
    ping: true,
  },
  attention: {
    label: "Attention needed",
    shortLabel: "Issue",
    className: "border-warning/20 bg-warning/10 text-warning",
    dotClass: "bg-warning",
    ping: false,
  },
};

/**
 * The overall pill is derived from the real summary — never hardcoded — and
 * distinguishes a brand-new, not-yet-checked account from a broken one.
 */
function resolvePillState(summary: DashboardSummary | null): PillState {
  if (!summary) return "attention";

  const { totalCount, activeCount, operationalCount, pendingCount, incidents24h } =
    summary;

  if (totalCount === 0) return "empty";
  if (activeCount === 0) return "paused";
  if (pendingCount === activeCount) return "pending";
  if (incidents24h === 0 && operationalCount === activeCount) return "healthy";
  return "attention";
}

export function Header({
  summary,
  userEmail,
  lastUpdatedAt,
  now,
  isRefreshing,
  onRefresh,
  onOpenCommandPalette,
  onAddMonitor,
}: HeaderProps) {
  const [isSigningOut, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOutAction();
    });
  };

  const pill = PILL[resolvePillState(summary)];
  const updatedLabel = formatRelativeTime(lastUpdatedAt, now);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        {/* Brand */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary">
              <Activity
                className="size-4 text-primary-foreground"
                aria-hidden="true"
              />
            </div>
            <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">
              DevPulse
            </span>
          </div>
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              pill.className,
            )}
            title={pill.label}
          >
            <span className="relative flex size-1.5">
              {pill.ping && (
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-80"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "relative inline-flex size-1.5 rounded-full",
                  pill.dotClass,
                )}
                aria-hidden="true"
              />
            </span>
            {/* On phones the pill switches to a short label so the header never
                overflows; the full label remains available via title. */}
            <span className="md:hidden">{pill.shortLabel}</span>
            <span className="hidden max-w-[14rem] truncate md:inline">
              {pill.label}
            </span>
          </span>
        </div>

        <div className="flex-1" />

        {/* Live refresh status */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card/80 px-1.5 py-1.5 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:px-2"
          title="Refresh dashboard data"
          aria-label={`Refresh dashboard. Updated ${updatedLabel}.`}
        >
          <RefreshCw
            className={cn("size-3", isRefreshing && "animate-spin")}
            aria-hidden="true"
          />
          <span className="hidden font-mono tabular-nums sm:inline">
            {isRefreshing ? "Refreshing…" : updatedLabel}
          </span>
        </button>

        {/* Command palette trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 rounded-md border border-border bg-card/80 px-2.5 py-1.5 text-xs text-muted-foreground outline-none transition-colors hover:border-ring/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open command palette"
        >
          <Search className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
            <Command className="size-2.5" aria-hidden="true" />K
          </kbd>
        </button>

        {/* Add new monitor */}
        <button
          type="button"
          onClick={onAddMonitor}
          className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3"
          title="Add a new monitor"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Add New Monitor</span>
        </button>

        <ThemeToggle />

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open user menu"
          >
            <div className="flex size-7 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
              {initialsFromEmail(userEmail)}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              <span className="flex items-center gap-2">
                <CircleUser className="size-4" aria-hidden="true" />
                <span className="max-w-[14rem] truncate">
                  {userEmail ?? "Signed in"}
                </span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isSigningOut}
              onSelect={() => {
                handleSignOut();
              }}
            >
              {isSigningOut ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <LogOut aria-hidden="true" />
              )}
              {isSigningOut ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
