/**
 * Owner-facing view of the Telegram alerting integration.
 *
 * `botUsername` is deployment configuration (the shared DevPulse bot), not
 * per-user data; it is `null` when Telegram alerts are not configured.
 */
export type TelegramSettings = {
  isConnected: boolean;
  isActive: boolean;
  username: string | null;
  notifyDegraded: boolean;
  botUsername: string | null;
};

export type TelegramLink = {
  /** `https://t.me/<bot>?start=<code>` */
  deepLink: string;
  /** The raw single-use code, shown for manual `/start <code>`. */
  code: string;
  expiresAt: string;
};
