"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortfolio } from "@/lib/PortfolioProvider";
import { Announcement, AnnouncementsResponse, fetchAnnouncements } from "@/lib/announcements";
import { formatDate, formatDateTime } from "@/lib/format";
import { Card } from "@/components/Card";

type FeedItem = Announcement & { symbol: string };

const SOURCE_STYLES: Record<Announcement["source"], string> = {
  "SEC EDGAR": "bg-amber-500/15 text-amber-400",
  Nasdaq: "bg-blue-500/15 text-blue-400",
  SGinvestors: "bg-violet-500/15 text-violet-400",
  "Corporate Action": "bg-emerald-500/15 text-emerald-400",
  "Yahoo Finance": "bg-purple-500/15 text-purple-400",
  SGX: "bg-rose-500/15 text-rose-400",
  "Google News": "bg-sky-500/15 text-sky-400",
};

export default function AnnouncementsPage() {
  const { state } = usePortfolio();
  const [items, setItems] = useState<Record<string, Announcement[]>>({});
  const [debug, setDebug] = useState<AnnouncementsResponse["debug"]>({});
  const [showDebug, setShowDebug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [symbolFilter, setSymbolFilter] = useState("ALL");

  const watchlist = state.watchlist;

  async function handleRefresh() {
    if (watchlist.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const { announcements, errors, debug } = await fetchAnnouncements(
        watchlist.map((w) => ({ symbol: w.symbol, name: w.name }))
      );
      setItems(announcements);
      setDebug(debug);
      setUpdatedAt(new Date().toISOString());
      if (Object.keys(announcements).length === 0 && errors.length > 0) {
        setError("Couldn't reach any announcement source right now.");
      }
    } catch {
      setError("Couldn't reach any announcement source right now.");
    } finally {
      setLoading(false);
    }
  }

  const watchlistKey = watchlist.map((w) => w.symbol).join(",");
  useEffect(() => {
    if (!watchlistKey) return;
    const id = setTimeout(() => handleRefresh(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistKey]);

  // Dividend history is already fetched elsewhere (dashboard's "Refresh
  // dividends") and cached in state, so it's folded in here as a corporate
  // action rather than fetched again.
  const feed: FeedItem[] = useMemo(() => {
    const combined: FeedItem[] = [];
    for (const w of watchlist) {
      for (const a of items[w.symbol] ?? []) {
        combined.push({ ...a, symbol: w.symbol });
      }
      for (const d of state.dividendHistory[w.symbol] ?? []) {
        combined.push({
          symbol: w.symbol,
          date: d.date,
          title: `Dividend: ${d.amount} per share`,
          source: "Corporate Action",
          summary: "A cash payment distributed to shareholders out of the company's profits.",
        });
      }
    }
    return combined
      .filter((f) => symbolFilter === "ALL" || f.symbol === symbolFilter)
      .sort((a, b) => (b.date || "0").localeCompare(a.date || "0"));
  }, [items, watchlist, state.dividendHistory, symbolFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">Announcements</h1>
        <div className="flex items-center gap-2">
          <select
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            className="rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-white"
          >
            <option value="ALL">All watched stocks</option>
            {watchlist.map((w) => (
              <option key={w.symbol} value={w.symbol}>
                {w.symbol}
              </option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={loading || watchlist.length === 0}
            className="px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        SEC EDGAR filings (US-listed stocks) and corporate actions (dividends, stock splits)
        are official/verified data. Nasdaq press releases, SGinvestors.io, Yahoo Finance and
        Google News entries are news/press coverage, not official regulatory filings, and may
        be incomplete. SGX doesn&apos;t publish a free, documented official filings API, so the
        &quot;SGX&quot; source here is a best-effort, unverified attempt at SGX&apos;s own
        announcement search endpoint and may not return results.
      </p>

      {error && <p className="text-xs text-amber-400">{error}</p>}

      {watchlist.length > 0 && Object.keys(debug).length > 0 && (
        <div className="text-xs">
          <button
            onClick={() => setShowDebug((s) => !s)}
            className="text-neutral-500 hover:text-neutral-300 underline"
          >
            {showDebug ? "Hide" : "Show"} source diagnostics
          </button>
          {showDebug && (
            <pre className="mt-2 p-3 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-400 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(debug, null, 2)}
            </pre>
          )}
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        {watchlist.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-neutral-500">
            Add stocks to your watchlist to see their announcements here.
          </div>
        ) : feed.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-neutral-500">
            {loading ? "Loading announcements…" : "No announcements found yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Date</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Stock</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Source</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Headline</th>
                </tr>
              </thead>
              <tbody>
                {feed.map((f, i) => (
                  <tr
                    key={`${f.symbol}-${i}`}
                    className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40"
                  >
                    <td className="px-4 sm:px-5 py-3 text-neutral-400 whitespace-nowrap">
                      {f.date ? formatDate(f.date) : "—"}
                    </td>
                    <td className="px-4 sm:px-5 py-3 font-medium text-white whitespace-nowrap">
                      {f.symbol}
                    </td>
                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_STYLES[f.source]}`}
                      >
                        {f.source}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-neutral-300">
                      {f.link ? (
                        <a
                          href={f.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-white hover:underline"
                        >
                          {f.title}
                        </a>
                      ) : (
                        f.title
                      )}
                      {f.summary && (
                        <p className="mt-1 text-xs text-neutral-500">{f.summary}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {updatedAt && (
          <div className="px-4 sm:px-5 py-2.5 border-t border-neutral-900 text-[11px] text-neutral-600">
            Last updated {formatDateTime(updatedAt)}
          </div>
        )}
      </Card>
    </div>
  );
}
