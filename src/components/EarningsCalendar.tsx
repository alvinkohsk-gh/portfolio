"use client";

import { useEffect, useState } from "react";
import { fetchEarningsDates, EarningsInfo } from "@/lib/earnings";
import { formatDate } from "@/lib/format";
import { Card, CardTitle } from "./Card";

/** Days from today to `date` (a yyyy-mm-dd string), floor-rounded. Negative
 * once the date has passed. */
function daysUntil(date: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(date) - Date.parse(today)) / msPerDay);
}

interface Row {
  symbol: string;
  name?: string;
  info: EarningsInfo;
}

/** Upcoming earnings dates for open holdings + watchlist symbols, from
 * Yahoo Finance's public, unofficial quoteSummary endpoint. That endpoint
 * has occasionally been locked down behind a crumb/cookie requirement, so a
 * symbol legitimately shows no row if the date can't be fetched - this
 * shows "no upcoming date" rather than failing the whole card. */
export function EarningsCalendar({
  symbols,
  names,
}: {
  symbols: string[];
  names: Record<string, string>;
}) {
  const [data, setData] = useState<Record<string, EarningsInfo>>({});
  const [loading, setLoading] = useState(false);

  const symbolsKey = [...symbols].sort().join(",");

  async function refresh() {
    if (symbols.length === 0) return;
    setLoading(true);
    try {
      const { data } = await fetchEarningsDates(symbols);
      if (Object.keys(data).length > 0) setData(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!symbolsKey) return;
    let cancelled = false;
    (async () => {
      const { data } = await fetchEarningsDates(symbolsKey.split(","));
      if (!cancelled && Object.keys(data).length > 0) setData(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  const upcoming: Row[] = Object.entries(data)
    .map(([symbol, info]) => ({ symbol, name: names[symbol], info }))
    .filter((r) => daysUntil(r.info.date) >= -1)
    .sort((a, b) => a.info.date.localeCompare(b.info.date));

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 sm:p-5 pb-0 flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Earnings Calendar</CardTitle>
        <button
          onClick={refresh}
          disabled={loading || symbols.length === 0}
          className="text-xs font-medium text-neutral-400 hover:text-white disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {upcoming.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-sm text-neutral-500 px-4 text-center">
          {symbols.length === 0
            ? "No holdings or watchlist symbols to check."
            : "No upcoming earnings dates found yet - try refreshing."}
        </div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                <th className="px-4 sm:px-5 py-2.5 font-medium">Stock</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Date</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium text-right">In</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((r) => {
                const days = daysUntil(r.info.date);
                const soon = days >= 0 && days <= 7;
                return (
                  <tr
                    key={r.symbol}
                    className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40"
                  >
                    <td className="px-4 sm:px-5 py-3">
                      <div className="font-medium text-white">{r.symbol}</div>
                      <div className="text-xs text-neutral-500 truncate max-w-[140px]">
                        {r.name ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                      {formatDate(r.info.date)}
                      {r.info.dateEnd ? ` – ${formatDate(r.info.dateEnd)}` : ""}
                    </td>
                    <td
                      className={`px-4 sm:px-5 py-3 text-right tabular-nums font-medium ${
                        soon ? "text-amber-400" : "text-neutral-400"
                      }`}
                    >
                      {days === 0 ? "Today" : days === 1 ? "Tomorrow" : days < 0 ? "—" : `${days}d`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
