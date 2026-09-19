"use client";

import { useEffect, useState } from "react";
import { fetchMarketMovers, fetchQuotes, MarketMoverQuote } from "@/lib/quotes";
import { formatCurrency, formatDateTime, formatPercent, gainColorClass } from "@/lib/format";
import { Card } from "./Card";

interface Mover {
  symbol: string;
  name?: string;
  changePct: number;
  price?: number;
  currency?: string;
}

/** Which price to display alongside the % change - the session's own price
 * (pre-market, regular, or after-hours), not necessarily q.price. */
interface SessionAccessors {
  changeFor: (q: MarketMoverQuote) => number | undefined;
  priceFor: (q: MarketMoverQuote) => number | undefined;
}

const MAX_MOVERS = 20;

/** Percent change from `from` to `to`, or undefined if either price is
 * missing - callers filter these out rather than showing a misleading 0%. */
function pctChange(from: number | undefined, to: number | undefined): number | undefined {
  if (from == null || to == null || from === 0) return undefined;
  return ((to - from) / from) * 100;
}

function ranked(quotes: Record<string, MarketMoverQuote>, { changeFor, priceFor }: SessionAccessors): Mover[] {
  return Object.entries(quotes)
    .map(([symbol, q]): Mover | null => {
      const changePct = changeFor(q);
      return changePct != null
        ? { symbol, name: q.name, changePct, price: priceFor(q), currency: q.currency }
        : null;
    })
    .filter((m): m is Mover => m !== null);
}

function topWinners(quotes: Record<string, MarketMoverQuote>, accessors: SessionAccessors): Mover[] {
  return ranked(quotes, accessors)
    .filter((m) => m.changePct > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, MAX_MOVERS);
}

function topLosers(quotes: Record<string, MarketMoverQuote>, accessors: SessionAccessors): Mover[] {
  return ranked(quotes, accessors)
    .filter((m) => m.changePct < 0)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, MAX_MOVERS);
}

function toTrackedQuoteMap(
  tracked: Record<
    string,
    { price: number; previousClose?: number; preMarketPrice?: number; postMarketPrice?: number; currency?: string }
  >,
  names: Record<string, string>
): Record<string, MarketMoverQuote> {
  return Object.fromEntries(
    Object.entries(tracked).map(([symbol, q]) => [
      symbol,
      {
        name: names[symbol],
        currency: q.currency,
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
                <a
                  href={`https://finance.yahoo.com/quote/${encodeURIComponent(m.symbol)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-white hover:text-emerald-400 hover:underline"
                >
                  {m.symbol}
                </a>
                {m.name && <span className="ml-1.5 text-xs text-neutral-500">{m.name}</span>}
              </div>
              <span className="shrink-0 flex items-baseline gap-1.5 tabular-nums text-xs">
                {m.price != null && (
                  <span className="text-neutral-400">{formatCurrency(m.price, m.currency ?? "USD")}</span>
                )}
                <span className={`font-medium ${gainColorClass(m.changePct)}`}>
                  {formatPercent(m.changePct)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SessionColumn({
  title,
  winners,
  losers,
}: {
  title: string;
  winners: Mover[];
  losers: Mover[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm font-medium text-white">{title}</div>
      <MoverList title="Winners" movers={winners} />
      <MoverList title="Losers" movers={losers} />
    </div>
  );
}

/** Ranks a market-wide candidate pool (Yahoo's day gainers/losers/most-active
 * screens) plus whatever the user holds or watches by price movement in
 * each trading session - pre-market, regular hours, and after-hours - using
 * Yahoo's pre/post market price fields. Winners and losers are ranked and
 * displayed separately rather than merged into one absolute-value list.
 * Since pre/post market fields are only populated by Yahoo during/shortly
 * after the relevant session, a list legitimately shows "No data" outside
 * its window. */
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

  const preMarket: SessionAccessors = {
    changeFor: (q) => pctChange(q.previousClose, q.preMarketPrice),
    priceFor: (q) => q.preMarketPrice,
  };
  const regular: SessionAccessors = {
    changeFor: (q) => pctChange(q.previousClose, q.price),
    priceFor: (q) => q.price,
  };
  const afterHours: SessionAccessors = {
    changeFor: (q) => pctChange(q.price, q.postMarketPrice),
    priceFor: (q) => q.postMarketPrice,
  };

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <SessionColumn
          title="Pre-Market"
          winners={topWinners(merged, preMarket)}
          losers={topLosers(merged, preMarket)}
        />
        <SessionColumn
          title="Regular Hours"
          winners={topWinners(merged, regular)}
          losers={topLosers(merged, regular)}
        />
        <SessionColumn
          title="After-Hours"
          winners={topWinners(merged, afterHours)}
          losers={topLosers(merged, afterHours)}
        />
      </div>
      <p className="mt-3 text-[11px] text-neutral-600">
        Winners and losers ranked separately by % move across today&apos;s most active market-wide
        movers plus your holdings and watchlist. Pre-market and after-hours data is only available
        from Yahoo Finance during/shortly after that session.
      </p>
    </Card>
  );
}
