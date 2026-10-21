"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
};

/**
 * Light/dark switch.
 *
 * Icons are chosen with CSS (`dark:` variant) rather than a mounted flag, so
 * the server HTML and the first client render always agree and no state update
 * is needed on mount.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();

  const handleToggle = (): void => {
    // `resolvedTheme` is undefined until next-themes mounts. Fall back to the
    // class the pre-paint script already applied, so the first click is correct.
    const isDark = resolvedTheme
      ? resolvedTheme === "dark"
      : document.documentElement.classList.contains("dark");

    setTheme(isDark ? "light" : "dark");
  };

  // The accessible name is intentionally theme-independent: deriving it from
  // the resolved theme would differ between the server render and hydration.
  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "flex size-8 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label="Toggle color theme"
      title="Toggle color theme"
    >
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
      <Moon className="block size-4 dark:hidden" aria-hidden="true" />
    </button>
  );
}
