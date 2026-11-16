"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

import type { AppTheme } from "@/config/app";

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: React.PropsWithChildren<{ defaultTheme?: AppTheme }>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      disableTransitionOnChange
      storageKey="orcha-chat-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
