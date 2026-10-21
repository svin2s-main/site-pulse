"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

type ThemeProviderProps = {
  children: ReactNode;
};

/**
 * Wraps the app so the `dark` class on <html> follows the stored preference.
 *
 * `next-themes` injects the theme before first paint, which is why the root
 * <html> element carries `suppressHydrationWarning`: the class differs between
 * the server render and the client, intentionally.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
