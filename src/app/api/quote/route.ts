import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface Quote {
  price: number;
  previousClose?: number;
  dayLow?: number;
  dayHigh?: number;
  currency?: string;
  name?: string;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
}

// Uses Yahoo Finance's public chart endpoint. It requires no API key, but is
// an unofficial/unsupported endpoint - if it changes shape or is unreachable
// from the deploy environment, this route simply omits that symbol and the
// client keeps whatever price it already has (manual or last-fetched).
async function fetchQuote(symbol: string): Promise<Quote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=1d`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;

  return {
    price: meta.regularMarketPrice,
    previousClose: meta.chartPreviousClose ?? meta.previousClose,
    dayLow: meta.regularMarketDayLow,
    dayHigh: meta.regularMarketDayHigh,
    currency: meta.currency,
    name: meta.symbol,
  };
}

// A separate call from fetchQuote's range=1d request, rather than folding
// this into one range=1y request: `chartPreviousClose` (which fetchQuote
// relies on for day-over-day change) is relative to the requested range's
// start date, so reusing a 1-year request for it would silently break the
// existing day-change figures. One extra request per symbol is a small
// price for not touching that already-working path.
async function fetchFiftyTwoWeekRange(
  symbol: string
): Promise<{ fiftyTwoWeekLow?: number; fiftyTwoWeekHigh?: number }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1wk&range=1y`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return {};

    const data = await res.json();
    const quote = data?.chart?.result?.[0]?.indicators?.quote?.[0];
    const lows: number[] = (quote?.low ?? []).filter((v: unknown) => typeof v === "number");
    const highs: number[] = (quote?.high ?? []).filter((v: unknown) => typeof v === "number");
    if (lows.length === 0 || highs.length === 0) return {};

    return { fiftyTwoWeekLow: Math.min(...lows), fiftyTwoWeekHigh: Math.max(...highs) };
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim()).filter(Boolean))];

  if (symbols.length === 0) {
    return NextResponse.json({ quotes: {}, errors: [] });
  }

  const quotes: Record<string, Quote> = {};
  const errors: string[] = [];

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        let quote = await fetchQuote(symbol);
        let resolvedSymbol = symbol;
        // Bare tickers (no exchange suffix) default to US exchanges on
        // Yahoo Finance. Fall back to the SGX (.SI) suffix so SGX-listed
        // counters (e.g. "D05" for DBS) resolve without the user having to
        // know Yahoo's suffix convention.
        if (!quote && !symbol.includes(".")) {
          quote = await fetchQuote(`${symbol}.SI`);
          resolvedSymbol = `${symbol}.SI`;
        }
        if (quote) {
          const range = await fetchFiftyTwoWeekRange(resolvedSymbol);
          quotes[symbol] = { ...quote, ...range };
        } else {
          errors.push(symbol);
        }
      } catch {
        errors.push(symbol);
      }
    })
  );

  return NextResponse.json({ quotes, errors });
}
