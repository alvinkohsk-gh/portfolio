"use client";

import { useMemo, useState } from "react";
import { usePortfolio } from "@/lib/PortfolioProvider";
import { allSymbols, computeRealizedEvents, currencyForPortfolio } from "@/lib/portfolio";
import { ALL_PORTFOLIOS } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card } from "@/components/Card";
import clsx from "clsx";

export default function RealizedPage() {
  const { state } = usePortfolio();
  const [filterSymbol, setFilterSymbol] = useState("ALL");

  const symbols = useMemo(() => allSymbols(state), [state]);
  const showPortfolioColumn = state.activePortfolioId === ALL_PORTFOLIOS;
  const portfolioName = (id: string) =>
    state.portfolios.find((p) => p.id === id)?.name ?? "—";

  const events = useMemo(() => {
    return computeRealizedEvents(state)
      .filter(
        (e) => state.activePortfolioId === ALL_PORTFOLIOS || e.portfolioId === state.activePortfolioId
      )
      .filter((e) => filterSymbol === "ALL" || e.symbol === filterSymbol);
  }, [state, filterSymbol]);

  const totalGain = useMemo(() => events.reduce((sum, e) => sum + e.gain, 0), [events]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">Realized P&amp;L</h1>
        <select
          value={filterSymbol}
          onChange={(e) => setFilterSymbol(e.target.value)}
          className="rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-white"
        >
          <option value="ALL">All symbols</option>
          {symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="text-xs text-neutral-500 mb-1">Total realized gain/loss</div>
        <div
          className={clsx(
            "text-2xl font-semibold tabular-nums",
            totalGain > 0 ? "text-emerald-400" : totalGain < 0 ? "text-rose-400" : "text-white"
          )}
        >
          {formatCurrency(totalGain, state.currency)}
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          Across {events.length} closed lot{events.length === 1 ? "" : "s"}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {events.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-neutral-500">
            No closed positions yet. Sells against a long, or buys covering a short, will show up
            here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Date</th>
                  {showPortfolioColumn && (
                    <th className="px-4 sm:px-5 py-2.5 font-medium">Portfolio</th>
                  )}
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Side</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Quantity</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Entry</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Exit</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Fees</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Gain/Loss</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const currency = currencyForPortfolio(state, e.portfolioId);
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40"
                    >
                      <td className="px-4 sm:px-5 py-3 text-neutral-300 whitespace-nowrap">
                        {formatDate(e.date)}
                      </td>
                      {showPortfolioColumn && (
                        <td className="px-4 sm:px-5 py-3 text-neutral-300 whitespace-nowrap">
                          {portfolioName(e.portfolioId)}
                        </td>
                      )}
                      <td className="px-4 sm:px-5 py-3">
                        <div className="font-medium text-white">{e.symbol}</div>
                        {e.name && <div className="text-xs text-neutral-500">{e.name}</div>}
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            e.side === "LONG"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-amber-500/15 text-amber-400"
                          )}
                        >
                          {e.side === "LONG" ? "Sold" : "Covered"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {e.quantity}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {formatCurrency(e.entryPrice, currency)}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {formatCurrency(e.exitPrice, currency)}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {formatCurrency(e.fees, currency)}
                      </td>
                      <td
                        className={clsx(
                          "px-4 sm:px-5 py-3 text-right tabular-nums font-medium",
                          e.gain > 0
                            ? "text-emerald-400"
                            : e.gain < 0
                            ? "text-rose-400"
                            : "text-white"
                        )}
                      >
                        {formatCurrency(e.gain, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
