export interface QuoteResult {
  price: number;
  previousClose?: number;
  dayLow?: number;
  dayHigh?: number;
  currency?: string;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
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
