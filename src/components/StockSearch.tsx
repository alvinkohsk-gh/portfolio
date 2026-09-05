"use client";

import { useEffect, useRef, useState } from "react";
import type { StockSearchResult } from "@/app/api/search/route";

export function StockSearch({
  onSelect,
  placeholder = "Search by name or ticker (e.g. Apple, D05.SI)",
}: {
  onSelect: (result: { symbol: string; name?: string }) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      // Nothing to search - the dropdown is hidden whenever the query is
      // empty (see the render below), so stale results/loading state from
      // a prior query never becomes visible.
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
        setHighlighted(0);
        setOpen(true);
      } catch {
        // aborted or unreachable - leave results as-is, manual fallback still works
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function commit(result: { symbol: string; name?: string }) {
    onSelect({ symbol: result.symbol.toUpperCase(), name: result.name });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  const trimmed = query.trim();
  const manualOption = trimmed.length > 0 ? { symbol: trimmed.toUpperCase() } : null;
  const rowCount = results.length + (manualOption ? 1 : 0);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || rowCount === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted < results.length) {
        commit(results[highlighted]);
      } else if (manualOption) {
        commit(manualOption);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full sm:w-80">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => trimmed.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
      />
      {open && trimmed.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-lg">
          {loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-neutral-500">Searching…</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.symbol}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(r)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 ${
                i === highlighted ? "bg-neutral-800" : "hover:bg-neutral-800/60"
              }`}
            >
              <span className="min-w-0">
                <span className="font-medium text-white">{r.symbol}</span>
                <span className="ml-2 text-neutral-400 truncate">{r.name}</span>
              </span>
              {r.exchange && (
                <span className="text-xs text-neutral-600 shrink-0">{r.exchange}</span>
              )}
            </button>
          ))}
          {!loading && manualOption && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(manualOption)}
              className={`w-full text-left px-3 py-2 text-sm text-neutral-400 border-t border-neutral-800 ${
                highlighted === results.length ? "bg-neutral-800" : "hover:bg-neutral-800/60"
              }`}
            >
              Use <span className="font-medium text-white">{manualOption.symbol}</span> as
              typed
            </button>
          )}
        </div>
      )}
    </div>
  );
}
