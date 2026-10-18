import "server-only";

/**
 * Server-only environment configuration.
 *
 * Reads and validates secrets at the point of use (lazily) rather than at
 * module import time, so that importing this module during a build — when
 * runtime environment variables may not be set yet — does not fail. Each access
 * re-reads from the live `process.env`.
 */

function read(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get appUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  },
  get supabaseUrl(): string {
    return read("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get serviceRoleKey(): string {
    return read("SUPABASE_SERVICE_ROLE_KEY");
  },
} as const;
