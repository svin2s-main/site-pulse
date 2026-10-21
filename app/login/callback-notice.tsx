"use client";

import { useSearchParams } from "next/navigation";

/**
 * Shows a message when the email-confirmation callback redirected here with an
 * error. Split into its own component (wrapped in <Suspense> by the form) so
 * that the form itself still ships in the static HTML.
 */
export function CallbackNotice() {
  const searchParams = useSearchParams();

  if (searchParams.get("error") !== "confirmation_failed") {
    return null;
  }

  return (
    <p role="alert" className="text-xs font-medium text-danger">
      We couldn&apos;t confirm your email. Try signing in, or sign up again.
    </p>
  );
}
