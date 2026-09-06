import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SplitEvent {
  date: string; // ISO date, yyyy-mm-dd
  ratio: number; // new shares per old share
}

// Same unofficial Yahoo Finance chart endpoint as /api/quote and
// /api/dividends, with events=split to pull historical stock splits
// (including reverse splits/consolidations, which come back as a ratio
// below 1) instead of a price or dividend history.
async function fetchSplitHistory(symbol: string): Promise<SplitEvent[] | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=25y&events=split`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const splits = result?.events?.splits;
  if (!splits || typeof splits !== "object") return [];

  return Object.values(
    splits as Record<string, { date?: number; numerator?: number; denominator?: number }>
  )
    .filter(
      (s): s is { date: number; numerator: number; denominator: number } =>
        typeof s?.date === "number" &&
        typeof s?.numerator === "number" &&
        typeof s?.denominator === "number" &&
        s.denominator !== 0
    )
    .map((s) => ({
      date: new Date(s.date * 1000).toISOString().slice(0, 10),
      ratio: s.numerator / s.denominator,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim()).filter(Boolean))];

  if (symbols.length === 0) {
    return NextResponse.json({ splits: {}, errors: [] });
  }

  const splits: Record<string, SplitEvent[]> = {};
  const errors: string[] = [];

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        let events = await fetchSplitHistory(symbol);
        if ((!events || events.length === 0) && !symbol.includes(".")) {
          const siEvents = await fetchSplitHistory(`${symbol}.SI`);
          if (siEvents && siEvents.length > 0) events = siEvents;
        }
        if (events) {
          splits[symbol] = events;
        } else {
          errors.push(symbol);
        }
      } catch {
        errors.push(symbol);
      }
    })
  );

  return NextResponse.json({ splits, errors });
}
