"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, Plus, Save, X } from "lucide-react";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  createMonitorAction,
  updateMonitorAction,
} from "@/app/actions/monitors";
import { toDashboardMonitor } from "@/lib/mappers";
import type { CheckInterval } from "@/lib/database.types";
import type { Monitor } from "@/types/monitor";

type MonitorFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this monitor instead of creating a new one. */
  monitor?: Monitor | null;
  onSaved: (monitor: Monitor) => void;
};

const INTERVAL_OPTIONS: { value: CheckInterval; label: string }[] = [
  { value: "30s", label: "Every 30 seconds" },
  { value: "1m", label: "Every minute" },
  { value: "5m", label: "Every 5 minutes" },
  { value: "15m", label: "Every 15 minutes" },
  { value: "1h", label: "Every hour" },
];

const FIELD_CLASS =
  "rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring";

export function MonitorFormDialog({
  open,
  onOpenChange,
  monitor = null,
  onSaved,
}: MonitorFormDialogProps) {
  const isEdit = monitor !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl outline-none">
          <div className="p-5">
            <div className="pr-8">
              <DialogTitle className="text-base font-semibold text-foreground">
                {isEdit ? "Edit Monitor" : "Add New Monitor"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                {isEdit
                  ? "Update the endpoint details or how often it is checked."
                  : "Track a new HTTP(S) endpoint for availability and response time."}
              </DialogDescription>
            </div>

            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            {/*
             * Keyed so the form state resets whenever the target changes
             * (create ↔ edit, or a different monitor) without an effect.
             */}
            <MonitorFormFields
              key={monitor?.id ?? "new"}
              monitor={monitor}
              onSaved={onSaved}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}

type MonitorFormFieldsProps = {
  monitor: Monitor | null;
  onSaved: (monitor: Monitor) => void;
  onCancel: () => void;
};

function MonitorFormFields({
  monitor,
  onSaved,
  onCancel,
}: MonitorFormFieldsProps) {
  const [name, setName] = useState(monitor?.name ?? "");
  const [url, setUrl] = useState(monitor?.url ?? "");
  const [interval, setInterval] = useState<CheckInterval>(
    monitor?.interval ?? "1m",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = monitor
        ? await updateMonitorAction({ id: monitor.id, name, url, interval })
        : await createMonitorAction({ name, url, interval });

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (monitor) {
        // Editing: keep the already-loaded history/heartbeats and only apply
        // the fields that changed, so the drawer doesn't blank out.
        onSaved({
          ...monitor,
          name: result.data.name,
          url: result.data.url,
          interval: result.data.interval,
        });
      } else {
        // Creating: the fresh row has no check logs yet.
        onSaved(toDashboardMonitor(result.data, []));
      }

      onCancel();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="monitor-name"
          className="text-xs font-medium text-foreground/80"
        >
          Name
        </label>
        <input
          id="monitor-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="API Gateway"
          required
          maxLength={100}
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="monitor-url"
          className="text-xs font-medium text-foreground/80"
        >
          URL
        </label>
        <input
          id="monitor-url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://api.example.com/health"
          required
          className={`${FIELD_CLASS} font-mono`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="monitor-interval"
          className="text-xs font-medium text-foreground/80"
        >
          Check interval
        </label>
        <select
          id="monitor-interval"
          value={interval}
          onChange={(event) =>
            setInterval(event.target.value as CheckInterval)
          }
          className={FIELD_CLASS}
        >
          {INTERVAL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : monitor ? (
            <Save className="size-3.5" aria-hidden="true" />
          ) : (
            <Plus className="size-3.5" aria-hidden="true" />
          )}
          {isPending ? "Saving..." : monitor ? "Save Changes" : "Add Monitor"}
        </button>
      </div>
    </form>
  );
}
