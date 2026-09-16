"use client";

import { useEffect, useState } from "react";
import { usePortfolio } from "@/lib/PortfolioProvider";
import { fetchQuotes } from "@/lib/quotes";
import { fetchPressure, PressureResult } from "@/lib/pressure";
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
  formatSignedCurrency,
  gainColorClass,
} from "@/lib/format";
import { Card } from "@/components/Card";
import { StockSearch } from "@/components/StockSearch";

interface WatchlistRow {
  symbol: string;
  name?: string;
  price?: number;
  change?: number;
  changePct?: number;
  dayLow?: number;
  dayHigh?: number;
  previousClose?: number;
  buyPct?: number;
  tags: string[];
  targetAbove?: number;
  targetBelow?: number;
}

/** Which bound (if any) the current price has reached/crossed. Purely a
 * visual flag - no email/push notifications are sent. */
function targetHit(r: WatchlistRow): "above" | "below" | null {
  if (r.price == null) return null;
  if (r.targetAbove != null && r.price >= r.targetAbove) return "above";
  if (r.targetBelow != null && r.price <= r.targetBelow) return "below";
  return null;
}

function parseTags(raw: string): string[] {
  return [...new Set(raw.split(",").map((t) => t.trim()).filter(Boolean))];
}

type Column = {
  key: string;
  label: string;
  value: (r: WatchlistRow) => number;
};

// A missing value sorts as though it were the smallest possible, so rows
// without a live quote yet fall to the start in ascending order and the end
// in descending order, rather than throwing off the comparison with NaN.
const MISSING = -Infinity;

const COLUMNS: Column[] = [
  { key: "price", label: "Price", value: (r) => r.price ?? MISSING },
  { key: "change", label: "Change", value: (r) => r.change ?? MISSING },
  { key: "dayLow", label: "Day Range", value: (r) => r.dayLow ?? MISSING },
  { key: "previousClose", label: "Last Close", value: (r) => r.previousClose ?? MISSING },
  { key: "buyPct", label: "Pressure", value: (r) => r.buyPct ?? MISSING },
];

// How often the page silently re-fetches quotes and pressure while open, so
// the Pressure column tracks intraday shifts without a manual refresh.
const LIVE_REFRESH_MS = 60_000;

export default function WatchlistPage() {
  const { state, addWatchlistItem, removeWatchlistItem, updateWatchlistItem } = usePortfolio();
  const [live, setLive] = useState<
    Record<string, { price: number; previousClose?: number; dayLow?: number; dayHigh?: number }>
  >({});
  const [pressure, setPressure] = useState<Record<string, PressureResult>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "symbol", dir: 1 });
  const [tagFilter, setTagFilter] = useState("ALL");

  function toggleSort(key: string) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));
  }

  function handleAdd(result: { symbol: string; name?: string }) {
    addWatchlistItem({ symbol: result.symbol, name: result.name });
  }

  async function handleRefresh() {
    if (state.watchlist.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const symbols = state.watchlist.map((w) => w.symbol);
      const [{ quotes, errors }, { pressure: freshPressure }] = await Promise.all([
        fetchQuotes(symbols),
        fetchPressure(symbols),
      ]);
      setLive((prev) => ({ ...prev, ...quotes }));
      setPressure((prev) => ({ ...prev, ...freshPressure }));
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

  // Fetch quotes and pressure as soon as the watchlist has symbols to show,
  // so the table isn't empty until the user clicks "Refresh prices" -
  // re-runs whenever the set of watched symbols changes (e.g. a new symbol
  // added), not on every render. Then keeps silently re-fetching on an
  // interval so the Pressure column tracks the trading day live rather than
  // freezing at whatever it read on page load.
  const watchlistKey = state.watchlist.map((w) => w.symbol).join(",");
  useEffect(() => {
    if (!watchlistKey) return;
    const id = setTimeout(() => handleRefresh(), 0);
    const interval = setInterval(() => handleRefresh(), LIVE_REFRESH_MS);
    return () => {
      clearTimeout(id);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistKey]);

  const rows: WatchlistRow[] = state.watchlist.map((w) => {
    const q = live[w.symbol];
    const change = q?.previousClose != null ? q.price - q.previousClose : undefined;
    const changePct =
      change != null && q!.previousClose! > 0 ? (change / q!.previousClose!) * 100 : undefined;
    return {
      symbol: w.symbol,
      name: w.name,
      price: q?.price,
      change,
      changePct,
      dayLow: q?.dayLow,
      dayHigh: q?.dayHigh,
      previousClose: q?.previousClose,
      buyPct: pressure[w.symbol]?.buyPct,
      tags: w.tags ?? [],
      targetAbove: w.targetAbove,
      targetBelow: w.targetBelow,
    };
  });

  const allTags = [...new Set(rows.flatMap((r) => r.tags))].sort();

  const filteredRows =
    tagFilter === "ALL" ? rows : rows.filter((r) => r.tags.includes(tagFilter));

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sort.key === "symbol") return sort.dir * a.symbol.localeCompare(b.symbol);
    const col = COLUMNS.find((c) => c.key === sort.key);
    const av = col ? col.value(a) : 0;
    const bv = col ? col.value(b) : 0;
    return sort.dir * (av - bv);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">Watchlist</h1>
        <div className="flex items-center gap-2">
          {allTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-white"
            >
              <option value="ALL">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading || state.watchlist.length === 0}
            className="px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white"
          >
            {loading ? "Refreshing…" : "Refresh prices"}
          </button>
        </div>
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
                  <th
                    onClick={() => toggleSort("symbol")}
                    className="px-4 sm:px-5 py-2.5 font-medium cursor-pointer select-none hover:text-neutral-300"
                  >
                    Symbol{sort.key === "symbol" ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                  </th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className="px-4 sm:px-5 py-2.5 font-medium text-right cursor-pointer select-none whitespace-nowrap hover:text-neutral-300"
                    >
                      {col.label}
                      {sort.key === col.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Tags</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Alert</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => {
                  const hit = targetHit(r);
                  return (
                  <tr
                    key={r.symbol}
                    className={`border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40 ${
                      hit ? "bg-amber-500/5" : ""
                    }`}
                  >
                    <td className="px-4 sm:px-5 py-3">
                      <div className="font-medium text-white flex items-center gap-1.5">
                        {r.symbol}
                        {hit && (
                          <span
                            title={
                              hit === "above"
                                ? `Price reached your target of ${r.targetAbove}`
                                : `Price fell to your target of ${r.targetBelow}`
                            }
                            className="text-amber-400"
                          >
                            🎯
                          </span>
                        )}
                      </div>
                      {r.name && <div className="text-xs text-neutral-500">{r.name}</div>}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-white">
                      {r.price != null ? formatCurrency(r.price, state.currency) : "—"}
                    </td>
                    <td
                      className={`px-4 sm:px-5 py-3 text-right tabular-nums ${
                        r.change != null ? gainColorClass(r.change) : "text-neutral-600"
                      }`}
                    >
                      {r.change != null ? (
                        <>
                          <div>{formatSignedCurrency(r.change, state.currency)}</div>
                          <div className="text-xs opacity-80">
                            {formatPercent(r.changePct!)}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                      {r.dayLow != null && r.dayHigh != null
                        ? `${formatCurrency(r.dayLow, state.currency)} – ${formatCurrency(
                            r.dayHigh,
                            state.currency
                          )}`
                        : "—"}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                      {r.previousClose != null
                        ? formatCurrency(r.previousClose, state.currency)
                        : "—"}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                      {r.buyPct != null ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-14 h-1.5 rounded-full bg-rose-500/40 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.round(r.buyPct)}%` }}
                            />
                          </div>
                          <span className="w-9 text-right">{Math.round(r.buyPct)}%</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 sm:px-5 py-3">
                      <input
                        type="text"
                        key={`tags-${r.symbol}-${r.tags.join(",")}`}
                        defaultValue={r.tags.join(", ")}
                        placeholder="e.g. core, spec"
                        onBlur={(e) =>
                          updateWatchlistItem(r.symbol, { tags: parseTags(e.target.value) })
                        }
                        className="w-28 rounded-md bg-neutral-950 border border-neutral-800 px-2 py-1 text-xs text-neutral-300 placeholder:text-neutral-700"
                      />
                    </td>
                    <td className="px-4 sm:px-5 py-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          key={`above-${r.symbol}-${r.targetAbove ?? ""}`}
                          defaultValue={r.targetAbove ?? ""}
                          placeholder="≥"
                          title="Alert when price rises to or above this"
                          onBlur={(e) =>
                            updateWatchlistItem(r.symbol, {
                              targetAbove: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="w-16 rounded-md bg-neutral-950 border border-neutral-800 px-1.5 py-1 text-xs text-neutral-300 placeholder:text-neutral-700"
                        />
                        <input
                          type="number"
                          step="any"
                          key={`below-${r.symbol}-${r.targetBelow ?? ""}`}
                          defaultValue={r.targetBelow ?? ""}
                          placeholder="≤"
                          title="Alert when price falls to or below this"
                          onBlur={(e) =>
                            updateWatchlistItem(r.symbol, {
                              targetBelow: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="w-16 rounded-md bg-neutral-950 border border-neutral-800 px-1.5 py-1 text-xs text-neutral-300 placeholder:text-neutral-700"
                        />
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right">
                      <button
                        onClick={() => removeWatchlistItem(r.symbol)}
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
            Last updated {formatDateTime(updatedAt)} - Pressure auto-refreshes every minute and
            estimates buying vs. selling volume from today&apos;s 1-minute bars (an
            uptick/downtick proxy, not real order-flow data). Alert (🎯) is a visual
            flag only when the page is open - it doesn&apos;t send an email or push
            notification.
          </div>
        )}
      </Card>
    </div>
  );
}
