"use client";

import { useEffect, useState } from "react";
import { fetchMarketMovers, fetchQuotes, MarketMoverQuote } from "@/lib/quotes";
import { formatDateTime, formatPercent, gainColorClass } from "@/lib/format";
import { Card } from "./Card";

interface Mover {
  symbol: string;
  name?: string;
  changePct: number;
}

const MAX_MOVERS = 20;

/** Percent change from `from` to `to`, or undefined if either price is
 * missing - callers filter these out rather than showing a misleading 0%. */
function pctChange(from: number | undefined, to: number | undefined): number | undefined {
  if (from == null || to == null || from === 0) return undefined;
  return ((to - from) / from) * 100;
}

function rankMovers(
  quotes: Record<string, MarketMoverQuote>,
  changeFor: (q: MarketMoverQuote) => number | undefined
): Mover[] {
  return Object.entries(quotes)
    .map(([symbol, q]): Mover | null => {
      const changePct = changeFor(q);
      return changePct != null ? { symbol, name: q.name, changePct } : null;
    })
    .filter((m): m is Mover => m !== null)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, MAX_MOVERS);
}

function toTrackedQuoteMap(
  tracked: Record<string, { price: number; previousClose?: number; preMarketPrice?: number; postMarketPrice?: number }>,
  names: Record<string, string>
): Record<string, MarketMoverQuote> {
  return Object.fromEntries(
    Object.entries(tracked).map(([symbol, q]) => [
      symbol,
      {
        name: names[symbol],
        price: q.price,
        previousClose: q.previousClose,
        preMarketPrice: q.preMarketPrice,
        postMarketPrice: q.postMarketPrice,
      },
    ])
  );
}

function MoverList({ title, movers }: { title: string; movers: Mover[] }) {
  return (
    <div>
      <div className="text-xs font-medium text-neutral-500 mb-2">{title}</div>
      {movers.length === 0 ? (
        <div className="text-xs text-neutral-600">No data right now.</div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {movers.map((m) => (
            <li key={m.symbol} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-white">{m.symbol}</span>
                {m.name && <span className="ml-1.5 text-xs text-neutral-500">{m.name}</span>}
              </div>
              <span className={`shrink-0 tabular-nums text-xs font-medium ${gainColorClass(m.changePct)}`}>
                {formatPercent(m.changePct)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Ranks a market-wide candidate pool (Yahoo's day gainers/losers/most-active
 * screens) plus whatever the user holds or watches by absolute price
 * movement in each trading session - pre-market, regular hours, and
 * after-hours - using Yahoo's pre/post market price fields. Since those
 * fields are only populated by Yahoo during/shortly after the relevant
 * session, a section legitimately shows "No data" outside its window. */
export function MoversPanel({
  symbols,
  names,
}: {
  symbols: string[];
  names: Record<string, string>;
}) {
  const [marketQuotes, setMarketQuotes] = useState<Record<string, MarketMoverQuote>>({});
  const [trackedQuotes, setTrackedQuotes] = useState<Record<string, MarketMoverQuote>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const symbolsKey = [...symbols].sort().join(",");

  async function refresh() {
    setLoading(true);
    try {
      const [market, tracked] = await Promise.all([
        fetchMarketMovers(),
        fetchQuotes(symbols).then((r) => r.quotes),
      ]);
      if (Object.keys(market).length > 0 || Object.keys(tracked).length > 0) {
        setMarketQuotes(market);
        setTrackedQuotes(toTrackedQuoteMap(tracked, names));
        setUpdatedAt(new Date().toISOString());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [market, tracked] = await Promise.all([
        fetchMarketMovers(),
        fetchQuotes(symbolsKey ? symbolsKey.split(",") : []).then((r) => r.quotes),
      ]);
      if (cancelled) return;
      if (Object.keys(market).length > 0 || Object.keys(tracked).length > 0) {
        setMarketQuotes(market);
        setTrackedQuotes(toTrackedQuoteMap(tracked, names));
        setUpdatedAt(new Date().toISOString());
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  // Tracked quotes (from the reliable per-symbol chart endpoint) take
  // precedence over the screener pool for any symbol appearing in both -
  // e.g. a holding that also happens to be a top mover today.
  const merged: Record<string, MarketMoverQuote> = { ...marketQuotes, ...trackedQuotes };

  const preMarket = rankMovers(merged, (q) => pctChange(q.previousClose, q.preMarketPrice));
  const regular = rankMovers(merged, (q) => pctChange(q.previousClose, q.price));
  const afterHours = rankMovers(merged, (q) => pctChange(q.price, q.postMarketPrice));

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-medium text-neutral-400">Today&apos;s Most Volatile Movers</h2>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MoverList title="Pre-Market" movers={preMarket} />
        <MoverList title="Regular Hours" movers={regular} />
        <MoverList title="After-Hours" movers={afterHours} />
      </div>
      <p className="mt-3 text-[11px] text-neutral-600">
        Ranked by absolute % move across today&apos;s most active market-wide movers plus your
        holdings and watchlist. Pre-market and after-hours data is only available from Yahoo
        Finance during/shortly after that session.
      </p>
    </Card>
  );
}
