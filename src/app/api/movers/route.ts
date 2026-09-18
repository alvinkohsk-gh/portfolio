import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ScreenerQuote {
  symbol?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  preMarketPrice?: number;
  postMarketPrice?: number;
}

export interface MarketMoverQuote {
  name?: string;
  price?: number;
  previousClose?: number;
  preMarketPrice?: number;
  postMarketPrice?: number;
}

// Yahoo Finance's public, unofficial screener endpoint - same no-key family
// as /api/quote and /api/pressure. Pulls three broad, pre-built market-wide
// lists (not just US large caps) so the movers panel isn't limited to
// whatever the user happens to hold or watch.
const SCREENER_IDS = ["day_gainers", "day_losers", "most_actives"];

async function fetchScreener(scrId: string): Promise<ScreenerQuote[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&lang=en-US&region=US&scrIds=${scrId}&count=50`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.finance?.result?.[0]?.quotes ?? [];
  } catch {
    return [];
  }
}

export async function GET() {
  const lists = await Promise.all(SCREENER_IDS.map(fetchScreener));
  const quotes: Record<string, MarketMoverQuote> = {};

  for (const list of lists) {
    for (const q of list) {
      if (!q.symbol || typeof q.regularMarketPrice !== "number") continue;
      quotes[q.symbol] = {
        name: q.shortName,
        price: q.regularMarketPrice,
        previousClose: q.regularMarketPreviousClose,
        preMarketPrice: typeof q.preMarketPrice === "number" ? q.preMarketPrice : undefined,
        postMarketPrice: typeof q.postMarketPrice === "number" ? q.postMarketPrice : undefined,
      };
    }
  }

  return NextResponse.json({ quotes });
}
