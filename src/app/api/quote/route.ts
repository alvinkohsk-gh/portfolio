import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface Quote {
  price: number;
  previousClose?: number;
  currency?: string;
  name?: string;
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
    currency: meta.currency,
    name: meta.symbol,
  };
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
        const quote = await fetchQuote(symbol);
        if (quote) {
          quotes[symbol] = quote;
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
