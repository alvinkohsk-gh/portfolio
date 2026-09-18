"use client";

import { useMemo, useState } from "react";
import { usePortfolio } from "@/lib/PortfolioProvider";
import { allSymbols, computeRealizedEvents, currencyForPortfolio } from "@/lib/portfolio";
import { ALL_PORTFOLIOS } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card } from "@/components/Card";
import clsx from "clsx";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// e.date is always an ISO yyyy-mm-dd string, so these are cheap slices
// rather than a Date parse (which would also need a timezone decision).
const yearOf = (date: string) => date.slice(0, 4);
const monthOf = (date: string) => date.slice(5, 7);
const dayOf = (date: string) => date.slice(8, 10);

export default function RealizedPage() {
  const { state } = usePortfolio();
  const [filterSymbol, setFilterSymbol] = useState("ALL");
  const [filterYear, setFilterYear] = useState("ALL");
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [filterDay, setFilterDay] = useState("ALL");

  const symbols = useMemo(() => allSymbols(state), [state]);
  const showPortfolioColumn = state.activePortfolioId === ALL_PORTFOLIOS;
  const portfolioName = (id: string) =>
    state.portfolios.find((p) => p.id === id)?.name ?? "—";

  // Scoped to the active portfolio only, so the year/month/day option lists
  // (and the symbol filter's date range) reflect what's actually browsable,
  // independent of the symbol/date filters below.
  const scopedEvents = useMemo(() => {
    return computeRealizedEvents(state).filter(
      (e) => state.activePortfolioId === ALL_PORTFOLIOS || e.portfolioId === state.activePortfolioId
    );
  }, [state]);

  const years = useMemo(
    () => [...new Set(scopedEvents.map((e) => yearOf(e.date)))].sort((a, b) => b.localeCompare(a)),
    [scopedEvents]
  );
  const months = useMemo(
    () =>
      [
        ...new Set(
          scopedEvents.filter((e) => filterYear === "ALL" || yearOf(e.date) === filterYear).map((e) => monthOf(e.date))
        ),
      ].sort(),
    [scopedEvents, filterYear]
  );
  const days = useMemo(
    () =>
      [
        ...new Set(
          scopedEvents
            .filter((e) => filterYear === "ALL" || yearOf(e.date) === filterYear)
            .filter((e) => filterMonth === "ALL" || monthOf(e.date) === filterMonth)
            .map((e) => dayOf(e.date))
        ),
      ].sort(),
    [scopedEvents, filterYear, filterMonth]
  );

  function handleYearChange(value: string) {
    setFilterYear(value);
    setFilterMonth("ALL");
    setFilterDay("ALL");
  }

  function handleMonthChange(value: string) {
    setFilterMonth(value);
    setFilterDay("ALL");
  }

  const events = useMemo(() => {
    return scopedEvents
      .filter((e) => filterSymbol === "ALL" || e.symbol === filterSymbol)
      .filter((e) => filterYear === "ALL" || yearOf(e.date) === filterYear)
      .filter((e) => filterMonth === "ALL" || monthOf(e.date) === filterMonth)
      .filter((e) => filterDay === "ALL" || dayOf(e.date) === filterDay);
  }, [scopedEvents, filterSymbol, filterYear, filterMonth, filterDay]);

  const totalGain = useMemo(() => events.reduce((sum, e) => sum + e.gain, 0), [events]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">Realized P&amp;L</h1>
        <div className="flex flex-wrap items-center gap-2">
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
          <select
            value={filterYear}
            onChange={(e) => handleYearChange(e.target.value)}
            className="rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-white"
          >
            <option value="ALL">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={filterMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            disabled={months.length === 0}
            className="rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-white disabled:opacity-50"
          >
            <option value="ALL">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {MONTH_NAMES[Number(m) - 1]}
              </option>
            ))}
          </select>
          <select
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            disabled={days.length === 0}
            className="rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-white disabled:opacity-50"
          >
            <option value="ALL">All days</option>
            {days.map((d) => (
              <option key={d} value={d}>
                {Number(d)}
              </option>
            ))}
          </select>
        </div>
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
