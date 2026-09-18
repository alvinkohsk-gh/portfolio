"use client";

import { useEffect, useState } from "react";
import { fetchQuotes, QuoteResult } from "@/lib/quotes";
import { formatDateTime, formatPercent, gainColorClass } from "@/lib/format";
import { Card } from "./Card";

interface Mover {
  symbol: string;
  name?: string;
  changePct: number;
}

const MAX_MOVERS = 5;

/** Percent change from `from` to `to`, or undefined if either price is
 * missing - callers filter these out rather than showing a misleading 0%. */
function pctChange(from: number | undefined, to: number | undefined): number | undefined {
  if (from == null || to == null || from === 0) return undefined;
  return ((to - from) / from) * 100;
}

function rankMovers(
  symbols: string[],
  names: Record<string, string>,
  quotes: Record<string, QuoteResult>,
  changeFor: (q: QuoteResult) => number | undefined
): Mover[] {
  return symbols
    .map((symbol): Mover | null => {
      const q = quotes[symbol];
      const changePct = q ? changeFor(q) : undefined;
      return changePct != null ? { symbol, name: names[symbol], changePct } : null;
    })
    .filter((m): m is Mover => m !== null)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, MAX_MOVERS);
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

/** Ranks the tracked symbols (holdings + watchlist) by absolute price
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
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const symbolsKey = [...symbols].sort().join(",");

  async function refresh() {
    if (symbols.length === 0) return;
    setLoading(true);
    try {
      const { quotes } = await fetchQuotes(symbols);
      if (Object.keys(quotes).length > 0) {
        setQuotes(quotes);
        setUpdatedAt(new Date().toISOString());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (symbolsKey === "") return;
    let cancelled = false;
    (async () => {
      const { quotes } = await fetchQuotes(symbolsKey.split(","));
      if (!cancelled && Object.keys(quotes).length > 0) {
        setQuotes(quotes);
        setUpdatedAt(new Date().toISOString());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  const preMarket = rankMovers(symbols, names, quotes, (q) =>
    pctChange(q.previousClose, q.preMarketPrice)
  );
  const regular = rankMovers(symbols, names, quotes, (q) => pctChange(q.previousClose, q.price));
  const afterHours = rankMovers(symbols, names, quotes, (q) =>
    pctChange(q.price, q.postMarketPrice)
  );

  if (symbols.length === 0) return null;

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
        Ranked by absolute % move among your holdings and watchlist. Pre-market and after-hours
        data is only available from Yahoo Finance during/shortly after that session.
      </p>
    </Card>
  );
}
