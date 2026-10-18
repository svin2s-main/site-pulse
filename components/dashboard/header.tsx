"use client";

import { useTransition } from "react";
import {
  Activity,
  CircleUser,
  Command,
  Loader2,
  LogOut,
  Plus,
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
import { cn } from "@/lib/utils";

type HeaderProps = {
  summary: DashboardSummary | null;
  userEmail: string | null;
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
  { label: string; className: string; dotClass: string; ping: boolean }
> = {
  empty: {
    label: "No monitors yet",
    className: "border-zinc-800 bg-zinc-900/80 text-zinc-400",
    dotClass: "bg-zinc-500",
    ping: false,
  },
  paused: {
    label: "All monitors paused",
    className: "border-zinc-800 bg-zinc-900/80 text-zinc-400",
    dotClass: "bg-zinc-500",
    ping: false,
  },
  pending: {
    label: "Awaiting first check",
    className: "border-sky-500/20 bg-sky-500/10 text-sky-400",
    dotClass: "bg-sky-400",
    ping: false,
  },
  healthy: {
    label: "All Systems Operational",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    dotClass: "bg-emerald-400",
    ping: true,
  },
  attention: {
    label: "Attention needed",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    dotClass: "bg-amber-400",
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

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-indigo-500">
              <Activity className="size-4 text-white" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
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
                  className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn("relative inline-flex size-1.5 rounded-full", pill.dotClass)}
                aria-hidden="true"
              />
            </span>
            {pill.label}
          </span>
        </div>

        <div className="flex-1" />

        {/* Command palette trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-500 outline-none transition-colors hover:border-zinc-700 hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Open command palette"
        >
          <Search className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden items-center gap-0.5 rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:flex">
            <Command className="size-2.5" aria-hidden="true" />K
          </kbd>
        </button>

        {/* Add new monitor */}
        <button
          type="button"
          onClick={onAddMonitor}
          className="flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white outline-none transition-colors hover:bg-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          title="Add a new monitor"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Add New Monitor</span>
        </button>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Open user menu"
          >
            <div className="flex size-7 items-center justify-center rounded-full border border-zinc-800 bg-zinc-800 text-xs font-semibold text-zinc-300">
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
