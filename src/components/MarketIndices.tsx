"use client";

import { useEffect, useState } from "react";
import { fetchQuotes, QuoteResult } from "@/lib/quotes";
import { formatDateTime, formatNumber, formatPercent, gainColorClass } from "@/lib/format";
import { Card } from "./Card";

const INDEXES = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^DJI", label: "Dow Jones" },
];

/** A compact row of the three major US index levels and today's change.
 * Index levels are points, not currency, so these are formatted as plain
 * numbers rather than through formatCurrency. */
export function MarketIndices() {
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { quotes } = await fetchQuotes(INDEXES.map((i) => i.symbol));
      if (!cancelled && Object.keys(quotes).length > 0) {
        setQuotes(quotes);
        setUpdatedAt(new Date().toISOString());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-medium text-neutral-400">US Markets</h2>
        {updatedAt && (
          <span className="text-[11px] text-neutral-600">
            Updated {formatDateTime(updatedAt)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {INDEXES.map(({ symbol, label }) => {
          const q = quotes[symbol];
          const change = q?.previousClose != null ? q.price - q.previousClose : undefined;
          const changePct =
            change != null && q!.previousClose! > 0 ? (change / q!.previousClose!) * 100 : undefined;
          return (
            <div key={symbol}>
              <div className="text-xs font-medium text-neutral-500">{label}</div>
              <div className="mt-1 text-lg sm:text-xl font-semibold tabular-nums text-white">
                {q ? formatNumber(q.price, 2) : "—"}
              </div>
              <div
                className={`mt-0.5 text-xs font-medium tabular-nums ${
                  change != null ? gainColorClass(change) : "text-neutral-600"
                }`}
              >
                {change != null
                  ? `${change > 0 ? "+" : ""}${formatNumber(change, 2)} (${formatPercent(
                      changePct!
                    )})`
                  : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
