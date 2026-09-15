import type { Metadata } from "next";
import "./globals.css";
import { AuthGate } from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "Portfolio Tracker",
  description: "Track your stock portfolio: holdings, performance, and dividends.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
