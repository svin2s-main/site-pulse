import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import {
  isTelegramWebhookAuthorized,
  sendTelegramMessage,
} from "@/lib/telegram";
import { hashTelegramLinkToken } from "@/lib/alerts";

/**
 * Telegram webhook for the shared DevPulse bot.
 *
 * Authentication is the `X-Telegram-Bot-Api-Secret-Token` header configured
 * when the webhook is registered. Linking is a single-use code exchange:
 *
 *   /start <code>  consume the code and attach this chat to its account
 *   /stop          pause alerts for this chat
 *
 * The webhook always acknowledges accepted updates with 200 so Telegram does
 * not retry a message and duplicate replies. Failures are logged server-side.
 */

const updateSchema = z.object({
  message: z
    .object({
      text: z.string().max(4_096).optional(),
      chat: z.object({
        id: z.union([
          z.number().int(),
          z.string().regex(/^-?\d+$/).transform((value) => Number(value)),
        ]),
        username: z.string().max(64).optional(),
      }),
      from: z
        .object({
          username: z.string().max(64).optional(),
        })
        .optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (
    !isTelegramWebhookAuthorized(
      request.headers.get("x-telegram-bot-api-secret-token"),
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const message = parsed.data.message;
  if (!message?.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const username =
    message.from?.username ?? message.chat.username ?? null;

  try {
    const [command, ...args] = message.text.trim().split(/\s+/);

    if (command === "/start") {
      const code = args[0];

      if (!code) {
        await sendTelegramMessage(
          String(chatId),
          [
            "👋 <b>DevPulse</b>",
            "",
            "Open your DevPulse dashboard → <b>Telegram Alerts</b> → <b>Connect Telegram</b> and use the link there.",
          ].join("\n"),
        );
        return NextResponse.json({ ok: true });
      }

      const admin = createAdminClient();

      // Atomically consume the code: only an unused, unexpired token can be
      // updated. A second /start with the same code finds no row.
      const now = new Date().toISOString();
      const { data: token, error: tokenError } = await admin
        .from("telegram_link_tokens")
        .update({ used_at: now })
        .eq("token_hash", hashTelegramLinkToken(code))
        .is("used_at", null)
        .gt("expires_at", now)
        .select("user_id")
        .maybeSingle();

      if (tokenError) {
        console.error("Failed to consume Telegram link token:", tokenError.message);
        return NextResponse.json({ ok: true });
      }

      if (!token) {
        await sendTelegramMessage(
          String(chatId),
          "This link is invalid or has expired. Generate a new one from your DevPulse dashboard.",
        );
        return NextResponse.json({ ok: true });
      }

      // One chat and one channel per account. Moving a chat to another account
      // (or re-linking) replaces the previous association instead of creating
      // duplicate deliveries.
      await admin
        .from("alert_channels")
        .delete()
        .eq("telegram_chat_id", chatId);
      await admin
        .from("alert_channels")
        .delete()
        .eq("user_id", token.user_id)
        .eq("type", "telegram");

      const { error: insertError } = await admin
        .from("alert_channels")
        .insert({
          user_id: token.user_id,
          type: "telegram",
          telegram_chat_id: chatId,
          telegram_username: username,
          is_active: true,
        });

      if (insertError) {
        console.error("Failed to link Telegram chat:", insertError.message);
        await sendTelegramMessage(
          String(chatId),
          "That link could not be completed. Please generate a new one from DevPulse.",
        );
        return NextResponse.json({ ok: true });
      }

      await sendTelegramMessage(
        String(chatId),
        [
          "✅ <b>DevPulse alerts connected</b>",
          "",
          "You will be notified when a monitor goes down and when it recovers.",
          `Manage alerts: ${env.appUrl}`,
          "",
          "Send /stop at any time to pause alerts.",
        ].join("\n"),
      );

      return NextResponse.json({ ok: true });
    }

    if (command === "/stop") {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("alert_channels")
        .update({ is_active: false })
        .eq("telegram_chat_id", chatId)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("Failed to pause Telegram alerts:", error.message);
        return NextResponse.json({ ok: true });
      }

      await sendTelegramMessage(
        String(chatId),
        data
          ? "🔕 DevPulse alerts paused. Use a new dashboard link to reconnect."
          : "No DevPulse alerts are connected to this chat.",
      );

      return NextResponse.json({ ok: true });
    }

    await sendTelegramMessage(
      String(chatId),
      [
        "🤖 <b>DevPulse bot</b>",
        "",
        "Connect alerts from your DevPulse dashboard.",
        "/stop — pause alerts for this chat",
      ].join("\n"),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Never echo the update body: it contains the one-time code.
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
