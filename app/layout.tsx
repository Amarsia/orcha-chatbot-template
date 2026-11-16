import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import type { CSSProperties } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { appConfig } from "@/config/app";

import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: `${appConfig.name} — ${appConfig.assistantLabel}`,
  description: appConfig.description,
  icons: { icon: [{ url: appConfig.icon }] },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const themeVars = {
    "--config-accent": appConfig.colors.accent,
    "--config-accent-hover": appConfig.colors.accentHover,
    "--config-light-bg": appConfig.colors.lightBackground,
    "--config-light-sidebar": appConfig.colors.lightSidebar,
    "--config-dark-bg": appConfig.colors.darkBackground,
    "--config-dark-sidebar": appConfig.colors.darkSidebar,
  } as CSSProperties;

  return (
    <html lang="en" suppressHydrationWarning style={themeVars}>
      <body className={`${geist.variable} ${geistMono.variable} ${newsreader.variable}`}>
        <ThemeProvider defaultTheme={appConfig.theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
