"use client";

import { usePortfolio } from "@/lib/PortfolioProvider";
import { StockTwitsPanel } from "@/components/StockTwitsPanel";

// StockTwits doesn't cover SGX-listed counters (Singapore Exchange, symbols
// suffixed ".SI"), so those are skipped rather than shown as permanent
// "No data" rows. Capped to 10 symbols to keep well under StockTwits'
// per-IP rate limit on its unauthenticated symbol-stream endpoint.
const MAX_SYMBOLS = 10;

export default function StockTwitsPage() {
  const { state } = usePortfolio();

  const watchlistSymbols = state.watchlist.map((w) => w.symbol);
  const symbols = watchlistSymbols
    .filter((symbol) => !symbol.toUpperCase().endsWith(".SI"))
    .slice(0, MAX_SYMBOLS);
  const names = Object.fromEntries(
    state.watchlist.filter((w) => w.name && symbols.includes(w.symbol)).map((w) => [w.symbol, w.name!])
  );
  const allSgx = watchlistSymbols.length > 0 && symbols.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-white">StockTwits</h1>
      {symbols.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 h-32 flex items-center justify-center text-sm text-neutral-500 text-center px-6">
          {allSgx
            ? "StockTwits doesn't cover SGX-listed counters (.SI), and every symbol on your watchlist is one."
            : "Add symbols to your watchlist to see StockTwits sentiment here."}
        </div>
      ) : (
        <StockTwitsPanel symbols={symbols} names={names} />
      )}
    </div>
  );
}
