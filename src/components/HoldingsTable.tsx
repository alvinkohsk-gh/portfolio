"use client";

import { useMemo, useState } from "react";
import { Holding } from "@/lib/types";
import { YieldMetrics } from "@/lib/portfolio";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatSignedCurrency,
  gainColorClass,
} from "@/lib/format";
import { Card } from "./Card";

/** Dividends received on a holding as a percentage of its cost basis -
 * "Div%" in the positions table. Not on `Holding` itself since it's a
 * simple derived ratio only this table needs. */
function divPct(h: Holding): number {
  return h.costBasis > 0 ? (h.dividends / h.costBasis) * 100 : 0;
}

type OpenColumn = {
  key: keyof Holding | "divPct";
  label: string;
  value: (h: Holding) => number;
};

const OPEN_COLUMNS: OpenColumn[] = [
  { key: "weight", label: "Port%", value: (h) => h.weight },
  { key: "quantity", label: "Shares", value: (h) => h.quantity },
  { key: "avgCost", label: "APrice", value: (h) => h.avgCost },
  { key: "currentPrice", label: "Close", value: (h) => h.currentPrice },
  { key: "marketValue", label: "Value", value: (h) => h.marketValue },
  { key: "dayChangePct", label: "Day%", value: (h) => h.dayChangePct },
  { key: "gainPct", label: "P&L%", value: (h) => h.gainPct },
  { key: "divPct", label: "Div%", value: divPct },
  { key: "totalReturnPct", label: "P&L+Div%", value: (h) => h.totalReturnPct },
];

type ClosedHolding = Holding & { totalClosed: number };

type ClosedColumn = {
  key: keyof ClosedHolding;
  label: string;
  value: (h: ClosedHolding) => number;
};

const CLOSED_COLUMNS: ClosedColumn[] = [
  { key: "realizedGain", label: "Realized", value: (h) => h.realizedGain },
  { key: "dividends", label: "Dividends", value: (h) => h.dividends },
  { key: "totalClosed", label: "Total (+Div)", value: (h) => h.totalClosed },
];

function matchesFilter(h: Holding, query: string): boolean {
  if (!query) return true;
  return h.symbol.toLowerCase().includes(query) || (h.name ?? "").toLowerCase().includes(query);
}

export function HoldingsTable({
  holdings,
  currency,
  yieldMetrics,
}: {
  holdings: Holding[];
  currency: string;
  yieldMetrics: YieldMetrics;
}) {
  const [view, setView] = useState<"open" | "closed">("open");
  const [filter, setFilter] = useState("");
  const [openSort, setOpenSort] = useState<{ key: string; dir: 1 | -1 }>({
    key: "marketValue",
    dir: -1,
  });
  const [closedSort, setClosedSort] = useState<{ key: string; dir: 1 | -1 }>({
    key: "totalClosed",
    dir: -1,
  });

  const open = useMemo(() => holdings.filter((h) => h.quantity > 0), [holdings]);
  const closed = useMemo(
    (): ClosedHolding[] =>
      holdings
        .filter((h) => h.quantity <= 0)
        .map((h) => ({ ...h, totalClosed: h.realizedGain + h.dividends })),
    [holdings]
  );

  const query = filter.trim().toLowerCase();

  const openRows = useMemo(() => {
    const col = OPEN_COLUMNS.find((c) => c.key === openSort.key);
    return open
      .filter((h) => matchesFilter(h, query))
      .sort((a, b) => {
        if (openSort.key === "symbol") return openSort.dir * a.symbol.localeCompare(b.symbol);
        const av = col ? col.value(a) : 0;
        const bv = col ? col.value(b) : 0;
        return openSort.dir * (av - bv);
      });
  }, [open, query, openSort]);

  const closedRows = useMemo(() => {
    const col = CLOSED_COLUMNS.find((c) => c.key === closedSort.key);
    return closed
      .filter((h) => matchesFilter(h, query))
      .sort((a, b) => {
        if (closedSort.key === "symbol") return closedSort.dir * a.symbol.localeCompare(b.symbol);
        const av = col ? col.value(a) : 0;
        const bv = col ? col.value(b) : 0;
        return closedSort.dir * (av - bv);
      });
  }, [closed, query, closedSort]);

  function toggleOpenSort(key: string) {
    setOpenSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));
  }
  function toggleClosedSort(key: string) {
    setClosedSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 sm:p-5 pb-0 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView("open")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              view === "open"
                ? "bg-neutral-800 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Current Positions
          </button>
          <button
            onClick={() => setView("closed")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              view === "closed"
                ? "bg-neutral-800 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Closed Positions
          </button>
        </div>
        {view === "open" && open.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-neutral-500 pt-1.5">
            <span>
              Current Yield:{" "}
              <span className="text-neutral-300">
                {formatPercent(yieldMetrics.currentYield).replace("+", "")}
              </span>
            </span>
            <span>
              Cost Yield:{" "}
              <span className="text-neutral-300">
                {formatPercent(yieldMetrics.costYield).replace("+", "")}
              </span>
            </span>
            <span>
              Projected Yield:{" "}
              <span className="text-neutral-300">
                {formatPercent(yieldMetrics.projectedYield).replace("+", "")}
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="px-4 sm:px-5 pt-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by symbol or company name"
          className="w-full max-w-xs rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-sm text-white placeholder:text-neutral-600"
        />
      </div>

      {view === "open" ? (
        open.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-neutral-500">
            No open holdings. Add a transaction to get started.
          </div>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                  <th
                    onClick={() => toggleOpenSort("symbol")}
                    className="px-4 sm:px-5 py-2.5 font-medium cursor-pointer select-none hover:text-neutral-300"
                  >
                    Name{openSort.key === "symbol" ? (openSort.dir === 1 ? " ▲" : " ▼") : ""}
                  </th>
                  {OPEN_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleOpenSort(col.key)}
                      className="px-4 sm:px-5 py-2.5 font-medium text-right cursor-pointer select-none whitespace-nowrap hover:text-neutral-300"
                    >
                      {col.label}
                      {openSort.key === col.key ? (openSort.dir === 1 ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {openRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={OPEN_COLUMNS.length + 1}
                      className="px-4 sm:px-5 py-8 text-center text-sm text-neutral-500"
                    >
                      No holdings match &quot;{filter}&quot;.
                    </td>
                  </tr>
                ) : (
                  openRows.map((h) => (
                    <tr
                      key={h.symbol}
                      className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40"
                    >
                      <td className="px-4 sm:px-5 py-3">
                        <div className="font-medium text-white">{h.symbol}</div>
                        <div className="text-xs text-neutral-500 truncate max-w-[140px]">
                          {h.name ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {formatPercent(h.weight, 1).replace("+", "")}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {formatNumber(h.quantity, 4)}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {formatCurrency(h.avgCost, currency)}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {formatCurrency(h.currentPrice, currency)}
                        {h.priceSource === "manual" && (
                          <span className="ml-1 text-neutral-600">(manual)</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-white">
                        {formatCurrency(h.marketValue, currency)}
                      </td>
                      <td
                        className={`px-4 sm:px-5 py-3 text-right tabular-nums ${gainColorClass(
                          h.dayChange
                        )}`}
                      >
                        {h.previousClose != null ? (
                          formatPercent(h.dayChangePct)
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                      <td
                        className={`px-4 sm:px-5 py-3 text-right tabular-nums ${gainColorClass(
                          h.gain
                        )}`}
                      >
                        {formatPercent(h.gainPct)}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {divPct(h) > 0 ? formatPercent(divPct(h)).replace("+", "") : "—"}
                      </td>
                      <td
                        className={`px-4 sm:px-5 py-3 text-right tabular-nums ${gainColorClass(
                          h.totalReturn
                        )}`}
                      >
                        {formatPercent(h.totalReturnPct)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )
      ) : closed.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-neutral-500">
          No closed positions yet.
        </div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                <th
                  onClick={() => toggleClosedSort("symbol")}
                  className="px-4 sm:px-5 py-2.5 font-medium cursor-pointer select-none hover:text-neutral-300"
                >
                  Name{closedSort.key === "symbol" ? (closedSort.dir === 1 ? " ▲" : " ▼") : ""}
                </th>
                {CLOSED_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleClosedSort(col.key)}
                    className="px-4 sm:px-5 py-2.5 font-medium text-right cursor-pointer select-none whitespace-nowrap hover:text-neutral-300"
                  >
                    {col.label}
                    {closedSort.key === col.key ? (closedSort.dir === 1 ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {closedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={CLOSED_COLUMNS.length + 1}
                    className="px-4 sm:px-5 py-8 text-center text-sm text-neutral-500"
                  >
                    No closed positions match &quot;{filter}&quot;.
                  </td>
                </tr>
              ) : (
                closedRows.map((h) => (
                  <tr
                    key={h.symbol}
                    className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40"
                  >
                    <td className="px-4 sm:px-5 py-3">
                      <div className="font-medium text-white">{h.symbol}</div>
                      <div className="text-xs text-neutral-500 truncate max-w-[140px]">
                        {h.name ?? "—"}
                      </div>
                    </td>
                    <td
                      className={`px-4 sm:px-5 py-3 text-right tabular-nums ${gainColorClass(
                        h.realizedGain
                      )}`}
                    >
                      {formatSignedCurrency(h.realizedGain, currency)}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                      {h.dividends > 0 ? formatCurrency(h.dividends, currency) : "—"}
                    </td>
                    <td
                      className={`px-4 sm:px-5 py-3 text-right tabular-nums ${gainColorClass(
                        h.totalClosed
                      )}`}
                    >
                      {formatSignedCurrency(h.totalClosed, currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === "open" && open.some((h) => h.priceUpdatedAt) && (
        <div className="px-4 sm:px-5 py-2.5 border-t border-neutral-900 text-[11px] text-neutral-600">
          Prices last updated{" "}
          {formatDateTime(
            open
              .filter((h) => h.priceUpdatedAt)
              .sort((a, b) => (b.priceUpdatedAt! > a.priceUpdatedAt! ? 1 : -1))[0].priceUpdatedAt!
          )}
        </div>
      )}
    </Card>
  );
}
