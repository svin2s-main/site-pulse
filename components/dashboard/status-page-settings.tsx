"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { saveStatusPageAction } from "@/app/actions/status-page";
import { CopyButton } from "@/components/dashboard/monitor-row-parts";
import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH } from "@/lib/slug";
import type { StatusPageSummary } from "@/types/status-page";

type StatusPageSettingsProps = {
  statusPage: StatusPageSummary | null;
  /** Suggested slug derived from the signed-in user's email. */
  defaultSlug: string;
  monitorCount: number;
  onSaved: (page: StatusPageSummary) => void;
};

const DEFAULT_TITLE = "System Status";

/** Public link base. Empty in a bare local setup, which yields a relative link. */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export function StatusPageSettings({
  statusPage,
  defaultSlug,
  monitorCount,
  onSaved,
}: StatusPageSettingsProps) {
  const [slug, setSlug] = useState(statusPage?.slug ?? defaultSlug);
  const [title, setTitle] = useState(statusPage?.title ?? DEFAULT_TITLE);
  const [isLive, setIsLive] = useState(statusPage?.isLive ?? false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSavedMessage(null);

    startTransition(async () => {
      const result = await saveStatusPageAction({ slug, title, isLive });

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Echo back the normalized values the server actually stored.
      setSlug(result.data.slug);
      setTitle(result.data.title);
      setIsLive(result.data.isLive);
      setSavedMessage(result.data.isLive ? "Published." : "Saved (not published).");
      onSaved(result.data);
    });
  };

  const link = `${APP_URL}/status/${slug}`;

  return (
    <section
      aria-labelledby="status-page-heading"
      className="rounded-lg border border-zinc-800 bg-zinc-900/80 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h2
              id="status-page-heading"
              className="text-sm font-semibold text-zinc-100"
            >
              Public Status Page
            </h2>
            <span
              className={
                isLive
                  ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
                  : "rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400"
              }
            >
              {isLive ? "Live" : "Off"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            Share live availability with your customers on a public URL.
          </p>
        </div>

        {isLive && (
          <div className="flex items-center gap-2">
            <span className="max-w-[16rem] truncate font-mono text-[11px] text-zinc-400">
              {link}
            </span>
            <CopyButton value={link} />
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 outline-none transition-colors hover:bg-zinc-900 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Open
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="status-page-title"
              className="text-xs font-medium text-zinc-300"
            >
              Page title
            </label>
            <input
              id="status-page-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={DEFAULT_TITLE}
              required
              maxLength={80}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-700 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="status-page-slug"
              className="text-xs font-medium text-zinc-300"
            >
              Public link
            </label>
            <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-900 focus-within:border-zinc-700 focus-within:ring-2 focus-within:ring-indigo-500">
              <span className="pl-3 font-mono text-xs text-zinc-600">
                /status/
              </span>
              <input
                id="status-page-slug"
                type="text"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="my-status"
                required
                minLength={SLUG_MIN_LENGTH}
                maxLength={SLUG_MAX_LENGTH}
                aria-describedby="status-page-slug-hint"
                className="w-full bg-transparent py-2 pr-3 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </div>
            <p id="status-page-slug-hint" className="text-[11px] text-zinc-500">
              Lowercase letters, numbers and single hyphens.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
          <div>
            <p className="text-xs font-medium text-zinc-300">Publish publicly</p>
            <p className="text-[11px] text-zinc-500">
              {monitorCount === 0
                ? "Add a monitor first — the page lists your monitors."
                : `Anyone with the link can view all ${monitorCount} of your monitors (paused ones are marked).`}
            </p>
          </div>
          <Switch
            checked={isLive}
            onCheckedChange={setIsLive}
            disabled={monitorCount === 0 && !isLive}
            aria-label="Publish the public status page"
          />
        </div>

        {(error || savedMessage) && (
          <p
            role="alert"
            className={
              error
                ? "mt-3 text-xs font-medium text-rose-500"
                : "mt-3 text-xs font-medium text-emerald-400"
            }
          >
            {error ?? savedMessage}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white outline-none transition-colors hover:bg-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-3.5" aria-hidden="true" />
            )}
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}
