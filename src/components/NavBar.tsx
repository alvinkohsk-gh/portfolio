"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { usePortfolio } from "@/lib/PortfolioProvider";
import { allSymbols } from "@/lib/portfolio";
import { fetchQuotes } from "@/lib/quotes";
import { PortfolioSelector } from "./PortfolioSelector";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/settings", label: "Settings" },
];

export function NavBar() {
  const pathname = usePathname();
  const { state, setLivePrices } = usePortfolio();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    const symbols = allSymbols(state);
    if (symbols.length === 0) return;
    setRefreshing(true);
    setError(null);
    try {
      const { quotes, errors } = await fetchQuotes(symbols);
      if (Object.keys(quotes).length > 0) {
        setLivePrices(quotes);
      }
      if (errors.length > 0 && Object.keys(quotes).length === 0) {
        setError("Couldn't reach the price provider. Try manual prices in Settings.");
      } else if (errors.length > 0) {
        setError(`No live price for: ${errors.join(", ")}`);
      }
    } catch {
      setError("Couldn't reach the price provider. Try manual prices in Settings.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <header className="border-b border-neutral-800 sticky top-0 z-10 bg-neutral-950/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-8">
          <span className="font-semibold text-lg tracking-tight text-white">
            Port<span className="text-emerald-400">folio</span>
          </span>
          <nav className="hidden sm:flex items-center gap-1">
            {links.map((link) => {
              const active =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="hidden md:inline text-xs text-amber-400">{error}</span>}
          <PortfolioSelector />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-sm font-medium px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {refreshing ? "Refreshing…" : "Refresh prices"}
          </button>
        </div>
      </div>
      <nav className="sm:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {links.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap",
                active ? "bg-neutral-800 text-white" : "text-neutral-400"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
