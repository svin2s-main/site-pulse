import Link from "next/link";
import { Activity } from "lucide-react";

type NotFoundNoticeProps = {
  title: string;
  description: string;
};

/**
 * Shared shell for the app's "nothing here" states, so the app-wide 404 and the
 * status-page 404 stay visually identical.
 */
export function NotFoundNotice({ title, description }: NotFoundNoticeProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-card">
        <Activity
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      </div>

      <h1 className="mt-6 text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>

      <Link
        href="/"
        className="mt-6 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        Go to DevPulse
      </Link>
    </main>
  );
}
