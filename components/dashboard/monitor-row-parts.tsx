"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  MoreHorizontal,
  Pencil,
  Pause,
  Trash2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { MonitorStatus } from "@/types/monitor";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { STATUS_CONFIG, formatLatency } from "@/lib/status";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  value: string;
};

export function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g., insecure context) — ignore.
    }
  };

  return (
    <button
      type="button"
      onClick={async (event) => {
        event.stopPropagation();
        await handleCopy();
      }}
      className="rounded p-0.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={copied ? "Copied" : "Copy endpoint URL"}
    >
      {copied ? (
        <Check className="size-3.5 text-success" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

type ActionMenuProps = {
  paused: boolean;
  isChecking: boolean;
  onCheckNow: () => void;
  onEdit: () => void;
  onTogglePause: () => void;
  onDelete: () => void;
};

export function ActionMenu({
  paused,
  isChecking,
  onCheckNow,
  onEdit,
  onTogglePause,
  onDelete,
}: ActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(event) => event.stopPropagation()}
        className="rounded p-1 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Monitor actions"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {/* Paused monitors are not checked, so the action is hidden rather than
            offered and then rejected. */}
        {!paused && (
          <DropdownMenuItem
            disabled={isChecking}
            onSelect={(event) => {
              event.stopPropagation();
              onCheckNow();
            }}
          >
            {isChecking ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            {isChecking ? "Checking..." : "Check now"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <Pencil aria-hidden="true" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.stopPropagation();
            onTogglePause();
          }}
        >
          <Pause aria-hidden="true" />
          {paused ? "Resume" : "Pause"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-danger focus:text-danger [&_svg]:text-danger focus:[&_svg]:text-danger"
          onSelect={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 aria-hidden="true" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type StatusBadgeProps = {
  status: MonitorStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        config.badgeClass,
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", config.dotClass)}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}

export { formatLatency };
