import "server-only";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Minimal Telegram Bot API client for the single shared DevPulse bot.
 *
 * The token never leaves the server and is never logged. All calls are bounded
 * by a timeout so a slow Telegram API cannot hold a check run open indefinitely.
 */

const TELEGRAM_API = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 8_000;

/** Escapes user-controlled text for Telegram's HTML parse mode. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Compares the webhook header with `TELEGRAM_WEBHOOK_SECRET` in constant time.
 * A missing secret disables the webhook rather than accepting every request.
 */
export function isTelegramWebhookAuthorized(header: string | null): boolean {
  const secret = env.telegramWebhookSecret;
  if (!secret || !header) return false;

  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(header, "utf8");

  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export type TelegramSendResult =
  | { ok: true }
  | { ok: false; error: string };

/** Sends one HTML message to a Telegram chat. Never throws. */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<TelegramSendResult> {
  const token = env.telegramBotToken;

  if (!token) {
    return { ok: false, error: "Telegram bot token is not configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${TELEGRAM_API}/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      // Telegram returns a JSON description; keep it short and never include
      // the request URL (which contains the bot token).
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Telegram API responded ${response.status}${
          detail ? `: ${detail.slice(0, 200)}` : ""
        }`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Telegram request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
