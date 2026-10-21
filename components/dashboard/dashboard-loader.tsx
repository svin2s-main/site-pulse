import { io } from "next/cache";
import { getDashboardDataAction } from "@/app/actions/monitors";
import { Dashboard } from "@/components/dashboard/dashboard";
import { toDashboardMonitor } from "@/lib/mappers";
import { getCurrentUser } from "@/lib/auth";
import type { TelegramSettings } from "@/types/alerts";

/**
 * Async Server Component that loads real dashboard data and hands it to the
 * interactive <Dashboard>. Kept separate from the page so it renders inside a
 * <Suspense> boundary and ships a skeleton in the static shell.
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/io
 */
export async function DashboardLoader() {
  // Exclude this subtree from the static shell. Everything below depends on the
  // request: the session cookie and the current time (the Supabase client and the
  // mappers both read `Date.now()`), which cannot be part of a prerender.
  await io();

  // Gate the route: anonymous visitors are redirected to /login by the DAL
  // before any data is fetched. This function never returns for guests.
  const user = await getCurrentUser();

  const result = await getDashboardDataAction();

  // A failure here is a real data/DB problem (auth already passed above), not
  // an unauthenticated visitor, so surfacing it is useful.
  const monitors =
    result.success === true
      ? result.data.monitors.map(({ monitor, recentLogs }) =>
          toDashboardMonitor(monitor, recentLogs),
        )
      : [];

  const summary = result.success === true ? result.data.summary : null;

  const telegram: TelegramSettings =
    result.success === true
      ? result.data.telegram
      : {
          isConnected: false,
          isActive: false,
          username: null,
          notifyDegraded: false,
          botUsername: null,
        };

  return (
    <Dashboard
      initialMonitors={monitors}
      initialSummary={summary}
      initialStatusPage={
        result.success === true ? result.data.statusPage : null
      }
      initialTelegram={telegram}
      userEmail={user.email}
      loadError={result.success ? null : result.error}
    />
  );
}
