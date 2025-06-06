import type { Metadata } from "next";
import { Geist, Azeret_Mono as Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers/providers";
import { Toaster } from "@/components/ui/toaster";
import type React from "react"; // Import React
import { LayoutContent } from "@/components/layout/layout-content"
import { PROJECT_CONFIG } from "@/lib/constants";
import { StoreInitializer } from "@/components/store-initializer";

import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: `${PROJECT_CONFIG.appName}`,
  description: "AI-powered assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased flex h-screen overflow-hidden`}
      >
        <Providers>
          <StoreInitializer />
          <LayoutContent>{children}</LayoutContent>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
