"use client";

import { useEffect, useState } from "react";
import { fetchAnalystRatings, AnalystInfo } from "@/lib/analysts";
import { formatCurrency, formatPercent, gainColorClass } from "@/lib/format";
import { Card, CardTitle } from "./Card";

const RATING_STYLES: Record<string, { label: string; className: string }> = {
  strong_buy: { label: "Strong Buy", className: "bg-emerald-500/15 text-emerald-400" },
  buy: { label: "Buy", className: "bg-emerald-500/15 text-emerald-400" },
  hold: { label: "Hold", className: "bg-neutral-700/50 text-neutral-300" },
  underperform: { label: "Underperform", className: "bg-amber-500/15 text-amber-400" },
  sell: { label: "Sell", className: "bg-rose-500/15 text-rose-400" },
  strong_sell: { label: "Strong Sell", className: "bg-rose-500/15 text-rose-400" },
};

function RatingBadge({ recommendationKey }: { recommendationKey?: string }) {
  const style = recommendationKey ? RATING_STYLES[recommendationKey] : undefined;
  if (!style) return <span className="text-xs text-neutral-600">—</span>;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

interface Row {
  symbol: string;
  name?: string;
  info: AnalystInfo;
  upsidePct?: number;
}

/** Analyst consensus rating and price target for open holdings + watchlist
 * symbols, from Yahoo Finance's public, unofficial quoteSummary endpoint.
 * Upside/downside is computed against the current price Yahoo itself used
 * for the target, not this app's own live quote, so the two figures stay
 * internally consistent even if the two prices differ slightly. */
export function AnalystRatingsCard({
  symbols,
  names,
}: {
  symbols: string[];
  names: Record<string, string>;
}) {
  const [data, setData] = useState<Record<string, AnalystInfo>>({});
  const [loading, setLoading] = useState(false);

  const symbolsKey = [...symbols].sort().join(",");

  async function refresh() {
    if (symbols.length === 0) return;
    setLoading(true);
    try {
      const { data } = await fetchAnalystRatings(symbols);
      if (Object.keys(data).length > 0) setData(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!symbolsKey) return;
    let cancelled = false;
    (async () => {
      const { data } = await fetchAnalystRatings(symbolsKey.split(","));
      if (!cancelled && Object.keys(data).length > 0) setData(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  const rows: Row[] = Object.entries(data)
    .map(([symbol, info]): Row => {
      const upsidePct =
        info.targetMeanPrice != null && info.currentPrice != null && info.currentPrice > 0
          ? ((info.targetMeanPrice - info.currentPrice) / info.currentPrice) * 100
          : undefined;
      return { symbol, name: names[symbol], info, upsidePct };
    })
    .sort((a, b) => (b.upsidePct ?? -Infinity) - (a.upsidePct ?? -Infinity));

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 sm:p-5 pb-0 flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Analyst Ratings</CardTitle>
        <button
          onClick={refresh}
          disabled={loading || symbols.length === 0}
          className="text-xs font-medium text-neutral-400 hover:text-white disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-sm text-neutral-500 px-4 text-center">
          {symbols.length === 0
            ? "No holdings or watchlist symbols to check."
            : "No analyst data found yet - try refreshing."}
        </div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                <th className="px-4 sm:px-5 py-2.5 font-medium">Stock</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium">Rating</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Target</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Upside</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
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
                  <td className="px-4 sm:px-5 py-3">
                    <RatingBadge recommendationKey={r.info.recommendationKey} />
                    {r.info.numberOfAnalysts != null && (
                      <div className="mt-0.5 text-[11px] text-neutral-600">
                        {r.info.numberOfAnalysts} analyst{r.info.numberOfAnalysts === 1 ? "" : "s"}
                      </div>
                    )}
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                    {r.info.targetMeanPrice != null ? formatCurrency(r.info.targetMeanPrice, "USD") : "—"}
                    {r.info.targetLowPrice != null && r.info.targetHighPrice != null && (
                      <div className="text-[11px] text-neutral-600">
                        {formatCurrency(r.info.targetLowPrice, "USD")}–
                        {formatCurrency(r.info.targetHighPrice, "USD")}
                      </div>
                    )}
                  </td>
                  <td
                    className={`px-4 sm:px-5 py-3 text-right tabular-nums font-medium ${
                      r.upsidePct != null ? gainColorClass(r.upsidePct) : "text-neutral-600"
                    }`}
                  >
                    {r.upsidePct != null ? formatPercent(r.upsidePct) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="px-4 sm:px-5 py-2.5 border-t border-neutral-900 text-[11px] text-neutral-600">
        Target prices are shown in whatever currency Yahoo Finance reports for that symbol,
        which may not match your display currency. Upside is calculated against Yahoo&apos;s
        own reference price, not necessarily today&apos;s live quote in this app.
      </p>
    </Card>
  );
}
