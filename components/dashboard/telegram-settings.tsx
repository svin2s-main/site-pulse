"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  Unplug,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CopyButton } from "@/components/dashboard/monitor-row-parts";
import {
  createTelegramLinkAction,
  disconnectTelegramAction,
  getTelegramSettingsAction,
  sendTelegramTestAction,
  updateTelegramPreferencesAction,
} from "@/app/actions/alerts";
import type { TelegramLink, TelegramSettings } from "@/types/alerts";
import { cn } from "@/lib/utils";

type TelegramSettingsCardProps = {
  settings: TelegramSettings;
  onSettingsChange: (settings: TelegramSettings) => void;
};

/** How often the card checks whether the user pressed Start in Telegram. */
const LINK_POLL_INTERVAL_MS = 3_000;

export function TelegramSettingsCard({
  settings,
  onSettingsChange,
}: TelegramSettingsCardProps) {
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "muted">("success");
  const [isPending, startTransition] = useTransition();

  const isConnected = settings.isConnected && settings.isActive;

  // While a link is on screen, poll for the webhook having linked the chat. The
  // interval is cleared as soon as the card switches to the connected view.
  useEffect(() => {
    if (!link) return;

    let cancelled = false;
    const timer = window.setInterval(() => {
      // Stop polling once the code can no longer be accepted; the user can
      // generate a fresh link from the same card.
      if (Date.now() >= Date.parse(link.expiresAt)) {
        cancelled = true;
        window.clearInterval(timer);
        setLink(null);
        setNoticeTone("muted");
        setNotice("That link expired. Generate a new one to connect Telegram.");
        return;
      }

      void (async () => {
        const result = await getTelegramSettingsAction();
        if (cancelled || !result.success) return;

        if (result.data.isConnected) {
          onSettingsChange(result.data);
          setLink(null);
          setNoticeTone("success");
          setNotice("Telegram connected. Alerts are ready.");
        }
      })();
    }, LINK_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [link, onSettingsChange]);

  const handleCreateLink = (): void => {
    setError(null);
    setNoticeTone("success");
    setNotice(null);

    startTransition(async () => {
      const result = await createTelegramLinkAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setLink(result.data);
    });
  };

  const handleCheckConnection = (): void => {
    setError(null);
    setNotice(null);
    setNoticeTone("success");

    startTransition(async () => {
      const result = await getTelegramSettingsAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (!result.data.isConnected) {
        setNoticeTone("muted");
        setNotice("Not connected yet. Open the link and press Start in Telegram.");
        return;
      }
      onSettingsChange(result.data);
      setLink(null);
      setNoticeTone("success");
      setNotice("Telegram connected. Alerts are ready.");
    });
  };

  const handleNotifyDegraded = (checked: boolean): void => {
    setError(null);
    setNoticeTone("success");
    setNotice(null);

    startTransition(async () => {
      const result = await updateTelegramPreferencesAction({
        notifyDegraded: checked,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSettingsChange(result.data);
      setNotice(
        checked
          ? "Degraded-performance alerts enabled."
          : "Degraded-performance alerts disabled.",
      );
    });
  };

  const handleTest = (): void => {
    setError(null);
    setNoticeTone("success");
    setNotice(null);

    startTransition(async () => {
      const result = await sendTelegramTestAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setNotice("Test message sent — check Telegram.");
    });
  };

  const handleDisconnect = (): void => {
    if (
      !window.confirm(
        "Disconnect Telegram alerts? You will stop receiving messages until you connect again.",
      )
    ) {
      return;
    }

    setError(null);
    setNoticeTone("success");
    setNotice(null);

    startTransition(async () => {
      const result = await disconnectTelegramAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSettingsChange({
        ...settings,
        isConnected: false,
        isActive: false,
        username: null,
        notifyDegraded: false,
      });
      setLink(null);
      setNotice("Telegram disconnected.");
    });
  };

  return (
    <section
      aria-labelledby="telegram-heading"
      className="rounded-lg border border-border bg-card/80 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <div className="flex items-center gap-2">
            <Send className="size-4 text-primary" aria-hidden="true" />
            <h2
              id="telegram-heading"
              className="text-sm font-semibold text-foreground"
            >
              Telegram Alerts
            </h2>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                isConnected
                  ? "border-success/20 bg-success/10 text-success"
                  : settings.isConnected
                    ? "border-warning/20 bg-warning/10 text-warning"
                    : "border-border bg-muted text-muted-foreground",
              )}
            >
              {isConnected
                ? "Connected"
                : settings.isConnected
                  ? "Paused"
                  : "Off"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Get a message when a monitor goes down and when it recovers.
          </p>
        </div>
      </div>

      <div className="p-4">
        {isConnected ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <p className="text-foreground/80">
                {settings.username
                  ? `Connected as @${settings.username}`
                  : "Telegram chat connected"}
              </p>
              <p className="text-muted-foreground">
                Down + recovered alerts are always on.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/60 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground/80">
                  Degraded performance
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Also alert when a successful check takes longer than 1s.
                  Off by default.
                </p>
              </div>
              <Switch
                checked={settings.notifyDegraded}
                onCheckedChange={handleNotifyDegraded}
                disabled={isPending}
                aria-label="Send alerts for degraded performance"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground/80 outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <Loader2
                    className="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send className="size-3.5" aria-hidden="true" />
                )}
                Send test
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-danger/10 hover:text-danger focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Unplug className="size-3.5" aria-hidden="true" />
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {settings.isConnected && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/20 bg-warning/10 px-3 py-2">
                <p className="text-[11px] text-warning">
                  Alerts are paused for this chat. Reconnect below to resume.
                </p>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-warning underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Unplug className="size-3" aria-hidden="true" />
                  Disconnect
                </button>
              </div>
            )}

            {settings.botUsername === null ? (
              <p className="text-xs text-muted-foreground">
                Telegram alerts are not configured on this deployment. Set
                TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME on the server.
              </p>
            ) : link ? (
              <div className="rounded-md border border-border bg-background/60 p-3">
                <p className="text-xs font-medium text-foreground/80">
                  1. Open the link and press <span className="font-semibold">Start</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a
                    href={link.deepLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Open Telegram
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                  <CopyButton value={link.deepLink} />
                  <button
                    type="button"
                    onClick={handleCheckConnection}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground/80 outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw
                      className={cn("size-3.5", isPending && "animate-spin")}
                      aria-hidden="true"
                    />
                    I&apos;ve pressed Start
                  </button>
                </div>

                <p className="mt-3 text-[11px] text-muted-foreground">
                  Or send{" "}
                  <code className="break-all font-mono text-foreground/80">
                    /start {link.code}
                  </code>{" "}
                  to @{settings.botUsername}.
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Link expires at{" "}
                  {new Date(link.expiresAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  . Waiting for Telegram…
                </p>

                <button
                  type="button"
                  onClick={handleCreateLink}
                  disabled={isPending}
                  className="mt-2 text-[11px] font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  Generate a new link
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCreateLink}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? (
                    <Loader2
                      className="size-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send className="size-3.5" aria-hidden="true" />
                  )}
                  {settings.isConnected ? "Reconnect Telegram" : "Connect Telegram"}
                </button>
                <p className="text-[11px] text-muted-foreground">
                  One-time link, expires in 10 minutes.
                </p>
              </div>
            )}
          </div>
        )}

        {(error || notice) && (
          <p
            role={error ? "alert" : "status"}
            className={cn(
              "mt-3 text-xs font-medium",
              error
                ? "text-danger"
                : noticeTone === "muted"
                  ? "text-muted-foreground"
                  : "text-success",
            )}
          >
            {error ?? notice}
          </p>
        )}
      </div>
    </section>
  );
}
