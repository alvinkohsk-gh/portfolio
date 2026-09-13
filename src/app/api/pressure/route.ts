import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface PressureResult {
  /** Share of today's classified volume traded on up-bars, 0-100. */
  buyPct: number;
  /** Total volume across bars that could be classified (excludes bars with
   * no volume, and the very first bar - it has no prior close to compare
   * against). */
  classifiedVolume: number;
  barCount: number;
}

// Approximates buying vs. selling pressure from 1-minute intraday bars via
// Yahoo Finance's public chart endpoint - the same unofficial/no-key family
// as /api/quote. There's no real order-flow (bid/ask lift vs. hit) data
// available for free, so this is an uptick/downtick proxy: a bar whose
// close is above the previous bar's close counts its volume as "buying
// pressure", below counts as "selling pressure", and an unchanged close is
// split evenly between both so it doesn't silently vanish from the total.
async function fetchPressure(symbol: string): Promise<PressureResult | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1m&range=1d`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const closes: unknown[] = quote?.close ?? [];
  const volumes: unknown[] = quote?.volume ?? [];
  if (closes.length < 2) return null;

  let buyVolume = 0;
  let sellVolume = 0;
  let barCount = 0;
  let prevClose: number | null = null;

  for (let i = 0; i < closes.length; i++) {
    const close = closes[i];
    const volume = volumes[i];
    if (typeof close !== "number" || typeof volume !== "number" || volume <= 0) continue;
    if (prevClose != null) {
      if (close > prevClose) buyVolume += volume;
      else if (close < prevClose) sellVolume += volume;
      else {
        buyVolume += volume / 2;
        sellVolume += volume / 2;
      }
      barCount++;
    }
    prevClose = close;
  }

  const classifiedVolume = buyVolume + sellVolume;
  if (classifiedVolume === 0) return null;

  return {
    buyPct: (buyVolume / classifiedVolume) * 100,
    classifiedVolume,
    barCount,
  };
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim()).filter(Boolean))];

  if (symbols.length === 0) {
    return NextResponse.json({ pressure: {}, errors: [] });
  }

  const pressure: Record<string, PressureResult> = {};
  const errors: string[] = [];

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        let result = await fetchPressure(symbol);
        // Same bare-ticker -> SGX fallback as /api/quote, so SGX-listed
        // counters resolve without the .SI suffix.
        if (!result && !symbol.includes(".")) {
          result = await fetchPressure(`${symbol}.SI`);
        }
        if (result) {
          pressure[symbol] = result;
        } else {
          errors.push(symbol);
        }
      } catch {
        errors.push(symbol);
      }
    })
  );

  return NextResponse.json({ pressure, errors });
}
