"use client";

import { useEffect, useState } from "react";
import { fetchStocktwits, StocktwitsSymbolData } from "@/lib/stocktwits";
import { formatDateTime } from "@/lib/format";
import { Card } from "./Card";

function SentimentBar({ data }: { data: StocktwitsSymbolData }) {
  const total = data.bullishCount + data.bearishCount;
  if (total === 0) {
    return <span className="text-xs text-neutral-600">No sentiment yet</span>;
  }
  const bullishPct = (data.bullishCount / total) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-rose-500/30 overflow-hidden shrink-0">
        <div className="h-full bg-emerald-500" style={{ width: `${bullishPct}%` }} />
      </div>
      <span className="text-xs text-neutral-500 tabular-nums">
        {data.bullishCount} bullish / {data.bearishCount} bearish
      </span>
    </div>
  );
}

function SymbolCard({ symbol, name, data }: { symbol: string; name?: string; data?: StocktwitsSymbolData }) {
  const latest = data?.messages[0];
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3.5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <a
          href={`https://stocktwits.com/symbol/${encodeURIComponent(symbol)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-white hover:text-emerald-400 hover:underline"
        >
          {symbol}
        </a>
        {data?.watchlistCount != null && (
          <span className="text-xs text-neutral-500">
            {data.watchlistCount.toLocaleString()} watching
          </span>
        )}
      </div>
      {name && <div className="text-xs text-neutral-500 -mt-1 truncate">{name}</div>}
      {data ? (
        <>
          <SentimentBar data={data} />
          {latest ? (
            <p className="text-xs text-neutral-400 line-clamp-2">
              <span className="text-neutral-500">@{latest.username ?? "trader"}:</span>{" "}
              {latest.body}
            </p>
          ) : (
            <p className="text-xs text-neutral-600">No recent messages.</p>
          )}
        </>
      ) : (
        <p className="text-xs text-neutral-600">No data right now.</p>
      )}
    </div>
  );
}

/** Pulls recent StockTwits activity (sentiment split and the latest
 * message) for each watchlist symbol via StockTwits' public, unofficial
 * streams endpoint. That endpoint has no API key but is rate-limited per
 * IP, so a symbol legitimately shows "No data" if it can't be reached. */
export function StockTwitsPanel({ symbols, names }: { symbols: string[]; names: Record<string, string> }) {
  const [data, setData] = useState<Record<string, StocktwitsSymbolData>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const symbolsKey = [...symbols].sort().join(",");

  async function refresh() {
    if (symbols.length === 0) return;
    setLoading(true);
    try {
      const { data } = await fetchStocktwits(symbols);
      if (Object.keys(data).length > 0) {
        setData(data);
        setUpdatedAt(new Date().toISOString());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!symbolsKey) return;
    let cancelled = false;
    (async () => {
      const { data } = await fetchStocktwits(symbolsKey.split(","));
      if (!cancelled && Object.keys(data).length > 0) {
        setData(data);
        setUpdatedAt(new Date().toISOString());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  if (symbols.length === 0) return null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-medium text-neutral-400">StockTwits</h2>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-[11px] text-neutral-600">Updated {formatDateTime(updatedAt)}</span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="text-xs font-medium text-neutral-400 hover:text-white disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {symbols.map((symbol) => (
          <SymbolCard key={symbol} symbol={symbol} name={names[symbol]} data={data[symbol]} />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-neutral-600">
        Sentiment and messages from StockTwits&apos; public symbol stream. This is an unofficial,
        rate-limited endpoint - a symbol may show &quot;No data&quot; if it can&apos;t be reached.
      </p>
    </Card>
  );
}
