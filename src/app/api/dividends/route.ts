import { NextRequest, NextResponse } from "next/server";
import { DividendEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

// Uses the same unofficial Yahoo Finance chart endpoint as /api/quote, with
// events=div to pull the full per-share dividend history instead of a
// price. Same best-effort contract: on failure this just omits the symbol
// and the client keeps whatever dividend history it already has cached.
async function fetchDividendHistory(symbol: string): Promise<DividendEvent[] | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=25y&events=div`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const dividends = result?.events?.dividends;
  if (!dividends || typeof dividends !== "object") return [];

  return Object.values(dividends as Record<string, { amount?: number; date?: number }>)
    .filter(
      (d): d is { amount: number; date: number } =>
        typeof d?.amount === "number" && typeof d?.date === "number"
    )
    .map((d) => ({
      date: new Date(d.date * 1000).toISOString().slice(0, 10),
      amount: d.amount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim()).filter(Boolean))];

  if (symbols.length === 0) {
    return NextResponse.json({ dividends: {}, errors: [] });
  }

  const dividends: Record<string, DividendEvent[]> = {};
  const errors: string[] = [];

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        let events = await fetchDividendHistory(symbol);
        // Same bare-ticker -> SGX fallback as /api/quote, so SGX-listed
        // counters resolve without the user knowing Yahoo's suffix.
        if ((!events || events.length === 0) && !symbol.includes(".")) {
          const siEvents = await fetchDividendHistory(`${symbol}.SI`);
          if (siEvents && siEvents.length > 0) events = siEvents;
        }
        if (events) {
          dividends[symbol] = events;
        } else {
          errors.push(symbol);
        }
      } catch {
        errors.push(symbol);
      }
    })
  );

  return NextResponse.json({ dividends, errors });
}
