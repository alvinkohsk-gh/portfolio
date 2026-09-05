"use client";

import { useState } from "react";
import { Holding } from "@/lib/types";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatSignedCurrency,
  gainColorClass,
} from "@/lib/format";
import { Card, CardTitle } from "./Card";

type SortKey = "symbol" | "marketValue" | "gain" | "gainPct" | "dayChange" | "weight";

export function HoldingsTable({
  holdings,
  currency,
}: {
  holdings: Holding[];
  currency: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("marketValue");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const open = holdings.filter((h) => h.quantity > 0);
  const sorted = [...open].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" || typeof bv === "string") {
      return sortDir * String(av).localeCompare(String(bv));
    }
    return sortDir * ((av as number) - (bv as number));
  });

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    } else {
      setSortKey(key);
      setSortDir(-1);
    }
  }

  const columns: { key: SortKey; label: string; align?: "right" }[] = [
    { key: "symbol", label: "Holding" },
    { key: "marketValue", label: "Value", align: "right" },
    { key: "gain", label: "Gain / Loss", align: "right" },
    { key: "gainPct", label: "Gain %", align: "right" },
    { key: "dayChange", label: "Today", align: "right" },
    { key: "weight", label: "Weight", align: "right" },
  ];

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 sm:p-5 pb-0">
        <CardTitle>Holdings</CardTitle>
      </div>
      {open.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-neutral-500">
          No open holdings. Add a transaction to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`px-4 sm:px-5 py-2.5 font-medium cursor-pointer select-none whitespace-nowrap hover:text-neutral-300 ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.label}
                    {sortKey === col.key ? (sortDir === 1 ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) => (
                <tr
                  key={h.symbol}
                  className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40"
                >
                  <td className="px-4 sm:px-5 py-3">
                    <div className="font-medium text-white">{h.symbol}</div>
                    <div className="text-xs text-neutral-500 truncate max-w-[140px]">
                      {h.name ?? "—"}
                    </div>
                    <div className="text-xs text-neutral-600 tabular-nums">
                      {formatNumber(h.quantity, 4)} sh @ {formatCurrency(h.avgCost, currency)}
                    </div>
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right tabular-nums">
                    <div className="text-white">{formatCurrency(h.marketValue, currency)}</div>
                    <div className="text-xs text-neutral-500">
                      {formatCurrency(h.currentPrice, currency)}
                      {h.priceSource === "manual" && (
                        <span className="ml-1 text-neutral-600">(manual)</span>
                      )}
                    </div>
                  </td>
                  <td
                    className={`px-4 sm:px-5 py-3 text-right tabular-nums ${gainColorClass(
                      h.gain
                    )}`}
                  >
                    {formatSignedCurrency(h.gain, currency)}
                  </td>
                  <td
                    className={`px-4 sm:px-5 py-3 text-right tabular-nums ${gainColorClass(
                      h.gainPct
                    )}`}
                  >
                    {formatPercent(h.gainPct)}
                  </td>
                  <td
                    className={`px-4 sm:px-5 py-3 text-right tabular-nums ${gainColorClass(
                      h.dayChange
                    )}`}
                  >
                    {h.previousClose != null ? (
                      <>
                        <div>{formatSignedCurrency(h.dayChange, currency)}</div>
                        <div className="text-xs">{formatPercent(h.dayChangePct)}</div>
                      </>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                    {formatPercent(h.weight, 1).replace("+", "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open.some((h) => h.priceUpdatedAt) && (
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
