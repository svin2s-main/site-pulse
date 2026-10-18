import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runChecksForMonitors } from "@/lib/check-runner";

/**
 * Cron check runner.
 *
 * Triggered by an external scheduler (Vercel Cron, GitHub Actions, etc.) via an
 * HTTP request. The caller must present the shared cron secret, otherwise this
 * route rejects the request. It is authenticated as the system (service role),
 * not as any signed-in user, so it is intentionally NOT an end-user endpoint.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: monitors, error } = await supabase
    .from("monitors")
    .select("*")
    .eq("is_paused", false);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load monitors" },
      { status: 500 },
    );
  }

  const { checked } = await runChecksForMonitors(monitors ?? [], supabase);

  return NextResponse.json({
    ok: true,
    monitored: monitors?.length ?? 0,
    checked,
    timestamp: new Date().toISOString(),
  });
}
