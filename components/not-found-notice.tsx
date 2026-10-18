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
      <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-800">
        <Activity className="size-4 text-zinc-400" aria-hidden="true" />
      </div>

      <h1 className="mt-6 text-lg font-semibold tracking-tight text-zinc-100">
        {title}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>

      <Link
        href="/"
        className="mt-6 rounded-md border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 outline-none transition-colors hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        Go to DevPulse
      </Link>
    </main>
  );
}
