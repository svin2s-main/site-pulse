/**
 * Shared result type for Server Actions. Every action returns either a
 * successful payload or a safe, user-facing error message. Raw database
 * errors and stack traces are never surfaced to the client.
 */
export type ActionResponse<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export function ok<T>(data: T): ActionResponse<T> {
  return { success: true, data };
}

export function fail(error: string): ActionResponse<never> {
  return { success: false, error };
}
