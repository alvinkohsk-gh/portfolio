import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Portfolio Tracker",
  description: "Track your stock portfolio: holdings, performance, and dividends.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Portfolio",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <NavBar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
        <footer className="text-center text-xs text-neutral-600 py-6">
          Data is stored locally in your browser. Nothing is sent to a server
          except optional price lookups.
        </footer>
      </body>
    </html>
  );
}
