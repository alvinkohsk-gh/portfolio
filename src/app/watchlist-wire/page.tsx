"use client";

import { useEffect, useState } from "react";
import { fetchWatchlistNews, WatchlistNewsRow, WatchlistNewsRun } from "@/lib/watchlistNews";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/Card";

const LAST_SEEN_KEY = "watchlist-wire:last-seen-at";

/** Reads the last-visit timestamp without touching it, so "new" badges for
 * this visit are computed against the *previous* visit - the timestamp
 * itself is only advanced when the viewer actually leaves (see the effect
 * below), not on every refresh, or a manual "Refresh" click would wipe out
 * the badges before the viewer had a chance to see them. */
function readLastSeen(): string | null {
  try {
    return window.localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function writeLastSeen(iso: string) {
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, iso);
  } catch {
    // Private browsing / quota - badges just won't persist across visits.
  }
}

export default function WatchlistWirePage() {
  const [rows, setRows] = useState<WatchlistNewsRow[]>([]);
  const [run, setRun] = useState<WatchlistNewsRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [lastSeen] = useState<string | null>(() => readLastSeen());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { rows, run } = await fetchWatchlistNews();
      setRows(rows);
      setRun(run);
    } catch {
      setError("Couldn't load the watchlist news scan right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();

    const markSeen = () => writeLastSeen(new Date().toISOString());
    document.addEventListener("visibilitychange", markSeen);
    window.addEventListener("beforeunload", markSeen);
    return () => {
      document.removeEventListener("visibilitychange", markSeen);
      window.removeEventListener("beforeunload", markSeen);
      markSeen();
    };
  }, []);

  const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : null;
  const isNew = (row: WatchlistNewsRow) =>
    lastSeenMs != null && new Date(row.updated_at).getTime() > lastSeenMs;
  const newCount = lastSeenMs != null ? rows.filter(isNew).length : 0;

  const filtered = (flaggedOnly ? rows.filter((r) => r.flagged) : rows).filter(
    (r) => !newOnly || isNew(r)
  );
  const usRows = filtered.filter((r) => r.market === "US");
  const sgxRows = filtered.filter((r) => r.market === "SGX");
  const otherRows = filtered.filter((r) => r.market !== "US" && r.market !== "SGX");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Watchlist Wire</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Twice-daily automated news scan across every watchlist stock (~8am and ~6pm SGT).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {newCount > 0 && (
            <button
              onClick={() => setNewOnly((n) => !n)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                newOnly
                  ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                  : "bg-neutral-900 border-neutral-700 text-neutral-400"
              }`}
            >
              {newOnly ? "Showing new only" : `New (${newCount})`}
            </button>
          )}
          <button
            onClick={() => setFlaggedOnly((f) => !f)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
              flaggedOnly
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : "bg-neutral-900 border-neutral-700 text-neutral-400"
            }`}
          >
            {flaggedOnly ? "Showing flagged only" : "Flagged only"}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <p className="text-xs text-neutral-600">
        Sourced by an automated web scan, not a licensed news feed - headlines are pointers to
        verify, not investment advice.{" "}
        {run && <>Last scan: {formatDateTime(run.ran_at)} ({run.count} stocks).</>}
      </p>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {rows.length === 0 ? (
        <Card>
          <div className="h-24 flex items-center justify-center text-sm text-neutral-500">
            {loading ? "Loading…" : "No scan results yet."}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {usRows.length > 0 && <MarketGroup title="US" rows={usRows} isNew={isNew} />}
          {sgxRows.length > 0 && <MarketGroup title="SGX" rows={sgxRows} isNew={isNew} />}
          {otherRows.length > 0 && <MarketGroup title="Other" rows={otherRows} isNew={isNew} />}
          {filtered.length === 0 && (
            <Card>
              <div className="h-20 flex items-center justify-center text-sm text-neutral-500">
                No flagged stocks in the latest scan.
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function MarketGroup({
  title,
  rows,
  isNew,
}: {
  title: string;
  rows: WatchlistNewsRow[];
  isNew: (row: WatchlistNewsRow) => boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {title} · {rows.length}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((row) => (
          <StockCard key={row.symbol} row={row} isNew={isNew(row)} />
        ))}
      </div>
    </div>
  );
}

function StockCard({ row, isNew }: { row: WatchlistNewsRow; isNew: boolean }) {
  const top = row.headlines[0];
  const rest = row.headlines.slice(1);

  return (
    <Card className={row.flagged ? "border-amber-500/40" : isNew ? "border-sky-500/40" : undefined}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono font-semibold text-white text-sm">{row.symbol}</span>
        <span className="text-xs text-neutral-500 truncate">{row.name}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {isNew && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-300 uppercase tracking-wide">
              New
            </span>
          )}
          {row.flagged && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 uppercase tracking-wide">
              Flagged
            </span>
          )}
        </div>
      </div>
      {top ? (
        <div className="flex flex-col gap-1">
          <a
            href={top.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-neutral-200 hover:text-white hover:underline"
          >
            {top.title}
          </a>
          <div className="text-[11px] text-neutral-600">{top.source}</div>
          {top.summary && <p className="text-xs text-neutral-500">{top.summary}</p>}
          {rest.length > 0 && (
            <details className="mt-1">
              <summary className="text-[11px] text-neutral-600 cursor-pointer">
                + {rest.length} more
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {rest.map((h, i) => (
                  <div key={i}>
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-neutral-300 hover:text-white hover:underline"
                    >
                      {h.title}
                    </a>
                    <div className="text-[11px] text-neutral-600">{h.source}</div>
                    {h.summary && <p className="text-xs text-neutral-500">{h.summary}</p>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <p className="text-xs text-neutral-600 italic">
          {row.note ?? "No notable news from the last scan."}
        </p>
      )}
    </Card>
  );
}
