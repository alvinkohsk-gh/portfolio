import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface StocktwitsMessage {
  id: number;
  body: string;
  created_at: string;
  user?: { username?: string };
  entities?: { sentiment?: { basic?: "Bullish" | "Bearish" } | null };
}

export interface StocktwitsSymbolData {
  watchlistCount?: number;
  bullishCount: number;
  bearishCount: number;
  messages: {
    id: number;
    body: string;
    createdAt: string;
    username?: string;
    sentiment: "Bullish" | "Bearish" | null;
  }[];
}

const MESSAGE_LIMIT = 5;

// StockTwits' public streams endpoint - no API key for read-only symbol
// streams, but it's unofficial/unsupported and rate-limited per IP. If it's
// unreachable or throttled from the deploy environment, this route simply
// omits that symbol and the client shows "No data" for it.
async function fetchSymbol(symbol: string): Promise<StocktwitsSymbolData | null> {
  const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.json`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = await res.json();
    const rawMessages: StocktwitsMessage[] = data?.messages ?? [];
    let bullishCount = 0;
    let bearishCount = 0;

    const messages = rawMessages.slice(0, MESSAGE_LIMIT).map((m) => {
      const sentiment = m.entities?.sentiment?.basic ?? null;
      if (sentiment === "Bullish") bullishCount++;
      else if (sentiment === "Bearish") bearishCount++;
      return {
        id: m.id,
        body: m.body,
        createdAt: m.created_at,
        username: m.user?.username,
        sentiment,
      };
    });

    return {
      watchlistCount: typeof data?.symbol?.watchlist_count === "number" ? data.symbol.watchlist_count : undefined,
      bullishCount,
      bearishCount,
      messages,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  // Capped well below StockTwits' per-IP rate limit for the unauthenticated
  // streams endpoint, so one page load can't exhaust it on its own.
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim()).filter(Boolean))].slice(
    0,
    15
  );

  if (symbols.length === 0) {
    return NextResponse.json({ data: {}, errors: [] });
  }

  const data: Record<string, StocktwitsSymbolData> = {};
  const errors: string[] = [];

  await Promise.all(
    symbols.map(async (symbol) => {
      const result = await fetchSymbol(symbol);
      if (result) {
        data[symbol] = result;
      } else {
        errors.push(symbol);
      }
    })
  );

  return NextResponse.json({ data, errors });
}
