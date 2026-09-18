export interface QuoteResult {
  price: number;
  previousClose?: number;
  dayLow?: number;
  dayHigh?: number;
  currency?: string;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  marketState?: string;
  preMarketPrice?: number;
  postMarketPrice?: number;
}

export async function fetchQuotes(
  symbols: string[]
): Promise<{ quotes: Record<string, QuoteResult>; errors: string[] }> {
  if (symbols.length === 0) return { quotes: {}, errors: [] };
  const res = await fetch(`/api/quote?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) {
    return { quotes: {}, errors: symbols };
  }
  return res.json();
}

export interface MarketMoverQuote {
  name?: string;
  currency?: string;
  price?: number;
  previousClose?: number;
  preMarketPrice?: number;
  postMarketPrice?: number;
}

/** A market-wide candidate pool (Yahoo's day gainers/losers/most-actives
 * screens) for the movers panel, independent of anything the user holds or
 * watches. */
export async function fetchMarketMovers(): Promise<Record<string, MarketMoverQuote>> {
  try {
    const res = await fetch("/api/movers");
    if (!res.ok) return {};
    const data = await res.json();
    return data.quotes ?? {};
  } catch {
    return {};
  }
}
