import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { escapeHtml, sendTelegramMessage } from "@/lib/telegram";
import type { AlertEventType, Database, MonitorStatus } from "@/lib/database.types";
import type { TelegramSettings } from "@/types/alerts";

/**
 * Alert routing and Telegram channel settings.
 *
 * The check runner calls `dispatchStatusAlert` after a status transition. It
 * uses the service-role client because the cron run has no user session; a
 * manual check goes through the same path, and the monitor row determines
 * whose channel is notified. Every failure is contained here so an alert
 * problem can never fail a health check.
 */

/** Down/degraded alerts for the same monitor are suppressed for this long. */
export const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

/** Dashboard-generated Telegram link codes are valid for this long. */
export const TELEGRAM_LINK_TTL_MS = 10 * 60 * 1000;

/** Avoid repeating the same missing-table warning on every dashboard refresh. */
let hasLoggedTelegramSettingsError = false;

/** SHA-256 of the raw deep-link code; only the hash is persisted. */
export function hashTelegramLinkToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Safe defaults for every failure mode: missing env vars, a missing
 * `alert_channels` table, or an unexpected Telegram/Supabase error. The rest of
 * the dashboard must keep loading even when alerting is misconfigured.
 */
export function fallbackTelegramSettings(): TelegramSettings {
  let botUsername: string | null = null;

  try {
    botUsername = env.telegramBotUsername;
  } catch (error) {
    console.error("Failed to read TELEGRAM_BOT_USERNAME:", error);
  }

  return {
    isConnected: false,
    isActive: false,
    username: null,
    notifyDegraded: false,
    botUsername,
  };
}

/**
 * Reads the caller's channel for the dashboard card. This function is
 * deliberately fail-safe: it never throws, so a Telegram problem can never take
 * down monitor loading.
 */
export async function loadTelegramSettings(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<TelegramSettings> {
  try {
    const { data, error } = await client
      .from("alert_channels")
      .select("telegram_username,is_active,notify_degraded")
      .eq("user_id", userId)
      .eq("type", "telegram")
      .maybeSingle();

    if (error && !hasLoggedTelegramSettingsError) {
      hasLoggedTelegramSettingsError = true;
      // Usually means migration 0002 has not been applied. Log the full error
      // (code/details/hint) so the cause is visible in the server console.
      console.error(
        "Failed to load Telegram settings — if this mentions alert_channels, apply supabase/migrations/0002_alerts.sql:",
        error,
      );
    }

    return {
      isConnected: Boolean(data),
      isActive: data?.is_active ?? false,
      username: data?.telegram_username ?? null,
      notifyDegraded: data?.notify_degraded ?? false,
      botUsername: env.telegramBotUsername,
    };
  } catch (error) {
    console.error("Unexpected error while loading Telegram settings:", error);
    return fallbackTelegramSettings();
  }
}

type AlertMonitor = {
  id: string;
  user_id: string;
  name: string;
  url: string;
  /** Status before the check that produced this transition. */
  status: MonitorStatus;
  alerts_enabled: boolean;
};

type DispatchArgs = {
  monitor: AlertMonitor;
  /** Status written by the check that just completed. */
  nextStatus: MonitorStatus;
  statusCode: number | null;
  latencyMs: number;
  errorMessage: string | null;
};

/**
 * Sends at most one alert for this transition.
 *
 * - down: any transition into `down`
 * - recovered: `down` → `operational` (the only recovery we notify)
 * - degraded: transitions into `degraded`, only when the owner opted in
 *
 * Down/degraded alerts share a 10-minute per-monitor cooldown; recoveries are
 * always sent so a short outage is not left without its "back up" message.
 */
export async function dispatchStatusAlert({
  monitor,
  nextStatus,
  statusCode,
  latencyMs,
  errorMessage,
}: DispatchArgs): Promise<void> {
  try {
    if (!monitor.alerts_enabled) return;
    if (monitor.status === nextStatus) return;
    if (nextStatus === "paused") return;

    const admin = createAdminClient();

    const { data: channel, error: channelError } = await admin
      .from("alert_channels")
      .select("id,telegram_chat_id,notify_degraded,is_active")
      .eq("user_id", monitor.user_id)
      .eq("type", "telegram")
      .maybeSingle();

    if (channelError) {
      console.error(
        `Failed to load alert channel for monitor ${monitor.id}:`,
        channelError.message,
      );
      return;
    }

    if (!channel || !channel.is_active) return;

    const type = resolveAlertType(
      monitor.status,
      nextStatus,
      channel.notify_degraded,
    );
    if (!type) return;

    if (type !== "recovered") {
      const cutoff = new Date(Date.now() - ALERT_COOLDOWN_MS).toISOString();
      const { data: recent, error: cooldownError } = await admin
        .from("alert_events")
        .select("id")
        .eq("monitor_id", monitor.id)
        .eq("type", type)
        .gte("created_at", cutoff)
        .limit(1)
        .maybeSingle();

      if (cooldownError) {
        console.error(
          `Failed to check alert cooldown for monitor ${monitor.id}:`,
          cooldownError.message,
        );
        return;
      }

      if (recent) return;
    }

    const message = formatAlertMessage({
      type,
      monitor,
      statusCode,
      latencyMs,
      errorMessage,
    });

    const sent = await sendTelegramMessage(
      String(channel.telegram_chat_id),
      message,
    );

    if (!sent.ok) {
      console.error(
        `Telegram alert failed for monitor ${monitor.id}: ${sent.error}`,
      );
      return;
    }

    const { error: insertError } = await admin.from("alert_events").insert({
      user_id: monitor.user_id,
      monitor_id: monitor.id,
      channel_id: channel.id,
      type,
      status_code: statusCode,
      latency_ms: latencyMs,
      error_message: errorMessage,
    });

    if (insertError) {
      // The message is already delivered; losing the audit row only means the
      // cooldown window may not see it. Never escalate to a check failure.
      console.error(
        `Failed to record alert event for monitor ${monitor.id}:`,
        insertError.message,
      );
    }
  } catch (error) {
    console.error(`Alert dispatch failed for monitor ${monitor.id}:`, error);
  }
}

function resolveAlertType(
  previousStatus: MonitorStatus,
  nextStatus: MonitorStatus,
  notifyDegraded: boolean,
): AlertEventType | null {
  if (nextStatus === "down" && previousStatus !== "down") return "down";
  if (previousStatus === "down" && nextStatus === "operational") {
    return "recovered";
  }
  if (
    notifyDegraded &&
    nextStatus === "degraded" &&
    previousStatus !== "degraded"
  ) {
    return "degraded";
  }
  return null;
}

type FormatAlertArgs = {
  type: AlertEventType;
  monitor: AlertMonitor;
  statusCode: number | null;
  latencyMs: number;
  errorMessage: string | null;
};

function formatAlertMessage({
  type,
  monitor,
  statusCode,
  latencyMs,
  errorMessage,
}: FormatAlertArgs): string {
  const heading =
    type === "down"
      ? "🔴 Monitor down"
      : type === "recovered"
        ? "🟢 Monitor recovered"
        : "🟠 Monitor degraded";

  const statusLabel =
    statusCode === null ? "No response" : `HTTP ${statusCode}`;

  const lines = [
    `<b>${escapeHtml(monitor.name)}</b>`,
    `<code>${escapeHtml(monitor.url.slice(0, 300))}</code>`,
    `Status: ${statusLabel}`,
    `Latency: ${latencyMs} ms`,
    `Time: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
  ];

  if (type === "down" && errorMessage) {
    lines.push(`Error: ${escapeHtml(errorMessage.slice(0, 300))}`);
  }

  return `${heading}\n\n${lines.join("\n")}`;
}
