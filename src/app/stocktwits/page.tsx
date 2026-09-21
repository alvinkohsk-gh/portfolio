"use client";

import { usePortfolio } from "@/lib/PortfolioProvider";
import { StockTwitsPanel } from "@/components/StockTwitsPanel";

export default function StockTwitsPage() {
  const { state } = usePortfolio();

  const symbols = state.watchlist.map((w) => w.symbol);
  const names = Object.fromEntries(
    state.watchlist.filter((w) => w.name).map((w) => [w.symbol, w.name!])
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-white">StockTwits</h1>
      {symbols.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 h-32 flex items-center justify-center text-sm text-neutral-500">
          Add symbols to your watchlist to see StockTwits sentiment here.
        </div>
      ) : (
        <StockTwitsPanel symbols={symbols} names={names} />
      )}
    </div>
  );
}
