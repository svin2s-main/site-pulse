"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { ok, fail, type ActionResponse } from "@/lib/action-result";
import {
  TELEGRAM_LINK_TTL_MS,
  hashTelegramLinkToken,
  loadTelegramSettings,
} from "@/lib/alerts";
import { sendTelegramMessage } from "@/lib/telegram";
import type { TelegramLink, TelegramSettings } from "@/types/alerts";

/**
 * Owner-facing Telegram actions.
 *
 * Linking starts with a short-lived, single-use code generated here. The code
 * is sent to Telegram by the user (via the t.me deep link) and consumed by the
 * webhook; chat ids are never accepted from the client.
 */

const preferencesSchema = z.object({
  notifyDegraded: z.boolean(),
});

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

/** Detects the "Telegram tables/columns are missing" migration error. */
function isMissingTelegramSchema(
  error: SupabaseErrorLike | null | undefined,
): boolean {
  if (!error) return false;

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("telegram_link_tokens") ||
    message.includes("alert_channels")
  );
}

function logActionError(context: string, error: unknown): void {
  console.error(`${context}:`, error);
}

const MISSING_MIGRATION_MESSAGE =
  "Telegram alerts are not set up yet. Apply supabase/migrations/0002_alerts.sql on the database.";

export async function createTelegramLinkAction(): Promise<
  ActionResponse<TelegramLink>
> {
  const botUsername = env.telegramBotUsername;

  if (!botUsername || !env.telegramBotToken) {
    return fail("Telegram alerts are not configured on this deployment");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Unauthorized");
  }

  // One active code per account: discard any unused code before issuing a new
  // one, so an older link cannot be replayed after the user regenerates it.
  const { error: cleanupError } = await supabase
    .from("telegram_link_tokens")
    .delete()
    .eq("user_id", user.id)
    .is("used_at", null);

  if (cleanupError) {
    logActionError(
      "createTelegramLinkAction: failed to clear old link tokens",
      cleanupError,
    );
    return fail(
      isMissingTelegramSchema(cleanupError)
        ? MISSING_MIGRATION_MESSAGE
        : "Could not prepare a Telegram link",
    );
  }

  // 32 random bytes → 43 base64url chars, which fits Telegram's 64-char limit
  // for the `start` deep-link payload. Only the hash is stored.
  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + TELEGRAM_LINK_TTL_MS,
  ).toISOString();

  const { error: insertError } = await supabase
    .from("telegram_link_tokens")
    .insert({
      user_id: user.id,
      token_hash: hashTelegramLinkToken(code),
      expires_at: expiresAt,
    });

  if (insertError) {
    logActionError(
      "createTelegramLinkAction: failed to insert link token",
      insertError,
    );
    return fail(
      isMissingTelegramSchema(insertError)
        ? MISSING_MIGRATION_MESSAGE
        : "Could not create a Telegram link",
    );
  }

  return ok({
    deepLink: `https://t.me/${botUsername}?start=${encodeURIComponent(code)}`,
    code,
    expiresAt,
  });
}

export async function getTelegramSettingsAction(): Promise<
  ActionResponse<TelegramSettings>
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Unauthorized");
  }

  return ok(await loadTelegramSettings(supabase, user.id));
}

export async function updateTelegramPreferencesAction(
  input: unknown,
): Promise<ActionResponse<TelegramSettings>> {
  const parsed = preferencesSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Invalid preferences");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Unauthorized");
  }

  // alert_channels has no authenticated UPDATE policy: chat ids may only be
  // written by the webhook. Preference changes therefore go through the
  // server with an explicit user_id filter, never a client-supplied id.
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("alert_channels")
      .update({ notify_degraded: parsed.data.notifyDegraded })
      .eq("user_id", user.id)
      .eq("type", "telegram")
      .select("id")
      .maybeSingle();

    if (error || !data) {
      if (error) {
        logActionError(
          "updateTelegramPreferencesAction: failed to update channel",
          error,
        );
      }
      return fail(
        isMissingTelegramSchema(error)
          ? MISSING_MIGRATION_MESSAGE
          : "Telegram is not connected",
      );
    }
  } catch (error) {
    logActionError(
      "updateTelegramPreferencesAction: unexpected error",
      error,
    );
    return fail("Could not update Telegram preferences");
  }

  revalidatePath("/");

  return ok(await loadTelegramSettings(supabase, user.id));
}

export async function sendTelegramTestAction(): Promise<
  ActionResponse<{ sent: true }>
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Unauthorized");
  }

  const { data: channel, error } = await supabase
    .from("alert_channels")
    .select("telegram_chat_id,is_active")
    .eq("user_id", user.id)
    .eq("type", "telegram")
    .maybeSingle();

  if (error || !channel) {
    if (error) {
      logActionError(
        "sendTelegramTestAction: failed to load channel",
        error,
      );
    }
    return fail(
      isMissingTelegramSchema(error)
        ? MISSING_MIGRATION_MESSAGE
        : "Telegram is not connected",
    );
  }

  if (!channel.is_active) {
    return fail("Telegram alerts are paused — connect again to resume them");
  }

  const result = await sendTelegramMessage(
    String(channel.telegram_chat_id),
    [
      "🔔 <b>DevPulse test alert</b>",
      "",
      "Telegram alerts are working. You will be notified when a monitor goes down or recovers.",
    ].join("\n"),
  );

  if (!result.ok) {
    console.error("Failed to send Telegram test message:", result.error);
    return fail("Could not send the test message");
  }

  return ok({ sent: true });
}

export async function disconnectTelegramAction(): Promise<
  ActionResponse<{ disconnected: true }>
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Unauthorized");
  }

  // The RLS delete policy scopes this to the caller's own channel; the explicit
  // filter is defense in depth.
  const { error } = await supabase
    .from("alert_channels")
    .delete()
    .eq("user_id", user.id)
    .eq("type", "telegram");

  if (error) {
    logActionError(
      "disconnectTelegramAction: failed to delete channel",
      error,
    );
    return fail(
      isMissingTelegramSchema(error)
        ? MISSING_MIGRATION_MESSAGE
        : "Could not disconnect Telegram",
    );
  }

  revalidatePath("/");

  return ok({ disconnected: true });
}
