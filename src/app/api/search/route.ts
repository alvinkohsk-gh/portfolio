import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

const RELEVANT_TYPES = new Set(["EQUITY", "ETF"]);

// Uses Yahoo Finance's public search/autocomplete endpoint - same
// unofficial API family as /api/quote, with the same no-key, best-effort
// approach: on failure this just returns an empty result list and the
// client falls back to typing a symbol in directly.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      q
    )}&quotesCount=8&newsCount=0&listsCount=0`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();
    const quotes: unknown[] = Array.isArray(data?.quotes) ? data.quotes : [];

    const results: StockSearchResult[] = quotes
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

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
