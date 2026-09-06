import { NextRequest, NextResponse } from "next/server";
import { SGX_DIRECTORY } from "@/lib/sgxDirectory";

export const dynamic = "force-dynamic";

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

const RELEVANT_TYPES = new Set(["EQUITY", "ETF"]);

/** Matches the local SGX directory against the query by symbol (with or
 * without the .SI suffix) or company name substring - Yahoo's search
 * endpoint sometimes under-indexes SGX names for a name-only query. */
function searchSgxDirectory(query: string): StockSearchResult[] {
  const q = query.toLowerCase();
  return SGX_DIRECTORY.filter((entry) => {
    const bareSymbol = entry.symbol.replace(/\.SI$/i, "").toLowerCase();
    return bareSymbol.includes(q) || entry.name.toLowerCase().includes(q);
  }).map((entry) => ({
    symbol: entry.symbol,
    name: entry.name,
    exchange: "SGX",
    type: "EQUITY",
  }));
}

// Uses Yahoo Finance's public search/autocomplete endpoint - same
// unofficial API family as /api/quote, with the same no-key, best-effort
// approach: on failure this just returns an empty result list and the
// client falls back to typing a symbol in directly.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // Doesn't need Yahoo to be reachable, so it's computed up front and used
  // as the fallback (or supplement) regardless of how the Yahoo call goes.
  const sgxMatches = searchSgxDirectory(q);

  let yahooResults: StockSearchResult[] = [];
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      q
    )}&quotesCount=8&newsCount=0&listsCount=0`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const quotes: unknown[] = Array.isArray(data?.quotes) ? data.quotes : [];

      yahooResults = quotes
        .map((raw): StockSearchResult | null => {
          const item = raw as Record<string, unknown>;
          const symbol = typeof item.symbol === "string" ? item.symbol : null;
          const type = typeof item.quoteType === "string" ? item.quoteType : undefined;
          if (!symbol || !type || !RELEVANT_TYPES.has(type)) return null;
          const name =
            (typeof item.shortname === "string" && item.shortname) ||
            (typeof item.longname === "string" && item.longname) ||
            symbol;
          const exchange =
            typeof item.exchDisp === "string"
              ? item.exchDisp
              : typeof item.exchange === "string"
                ? item.exchange
                : undefined;
          return { symbol, name, exchange, type };
        })
        .filter((r): r is StockSearchResult => r !== null);
    }
  } catch {
    // Yahoo unreachable - sgxMatches (if any) still gets returned below.
  }

  const seen = new Set(yahooResults.map((r) => r.symbol.toUpperCase()));
  const merged = [
    ...yahooResults,
    ...sgxMatches.filter((r) => !seen.has(r.symbol.toUpperCase())),
  ];

  return NextResponse.json({ results: merged });
}
