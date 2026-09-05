"use client";

import { useState } from "react";
import { usePortfolio } from "@/lib/PortfolioProvider";
import { fetchQuotes } from "@/lib/quotes";
import { formatCurrency, formatDateTime, formatPercent, gainColorClass } from "@/lib/format";
import { Card } from "@/components/Card";
import { StockSearch } from "@/components/StockSearch";

export default function WatchlistPage() {
  const { state, addWatchlistItem, removeWatchlistItem } = usePortfolio();
  const [live, setLive] = useState<
    Record<string, { price: number; previousClose?: number; dayLow?: number; dayHigh?: number }>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  function handleAdd(result: { symbol: string; name?: string }) {
    addWatchlistItem({ symbol: result.symbol, name: result.name });
  }

  async function handleRefresh() {
    if (state.watchlist.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const { quotes, errors } = await fetchQuotes(state.watchlist.map((w) => w.symbol));
      setLive((prev) => ({ ...prev, ...quotes }));
      setUpdatedAt(new Date().toISOString());
      if (Object.keys(quotes).length === 0 && errors.length > 0) {
        setError("Couldn't reach the price provider right now.");
      }
    } catch {
      setError("Couldn't reach the price provider right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">Watchlist</h1>
        <button
          onClick={handleRefresh}
          disabled={loading || state.watchlist.length === 0}
          className="px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white"
        >
          {loading ? "Refreshing…" : "Refresh prices"}
        </button>
      </div>

      <Card>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Add to watchlist
          <StockSearch onSelect={handleAdd} />
        </label>
        {error && <p className="mt-2 text-xs text-amber-400">{error}</p>}
      </Card>

      <Card className="p-0 overflow-hidden">
        {state.watchlist.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-neutral-500">
            Your watchlist is empty.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Price</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Change</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Day Range</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Last Close</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.watchlist.map((w) => {
                  const q = live[w.symbol];
                  const change =
                    q?.previousClose != null ? q.price - q.previousClose : undefined;
                  const changePct =
                    q?.previousClose != null && q.previousClose > 0
                      ? (change! / q.previousClose) * 100
                      : undefined;
                  return (
                    <tr
                      key={w.symbol}
                      className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40"
                    >
                      <td className="px-4 sm:px-5 py-3">
                        <div className="font-medium text-white">{w.symbol}</div>
                        {w.name && <div className="text-xs text-neutral-500">{w.name}</div>}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-white">
                        {q ? formatCurrency(q.price, state.currency) : "—"}
                      </td>
                      <td
                        className={`px-4 sm:px-5 py-3 text-right tabular-nums ${
                          change != null ? gainColorClass(change) : "text-neutral-600"
                        }`}
                      >
                        {change != null ? formatPercent(changePct!) : "—"}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {q?.dayLow != null && q?.dayHigh != null
                          ? `${formatCurrency(q.dayLow, state.currency)} – ${formatCurrency(
                              q.dayHigh,
                              state.currency
                            )}`
                          : "—"}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {q?.previousClose != null
                          ? formatCurrency(q.previousClose, state.currency)
                          : "—"}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right">
                        <button
                          onClick={() => removeWatchlistItem(w.symbol)}
                          className="text-xs text-rose-500 hover:text-rose-400"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {updatedAt && (
          <div className="px-4 sm:px-5 py-2.5 border-t border-neutral-900 text-[11px] text-neutral-600">
            Last updated {formatDateTime(updatedAt)}
          </div>
        )}
      </Card>
    </div>
  );
}
