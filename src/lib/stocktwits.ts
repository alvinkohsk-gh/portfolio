export interface StocktwitsMessage {
  id: number;
  body: string;
  createdAt: string;
  username?: string;
  sentiment: "Bullish" | "Bearish" | null;
}

export interface StocktwitsSymbolData {
  watchlistCount?: number;
  bullishCount: number;
  bearishCount: number;
  messages: StocktwitsMessage[];
}

export async function fetchStocktwits(
  symbols: string[]
): Promise<{ data: Record<string, StocktwitsSymbolData>; errors: string[] }> {
  if (symbols.length === 0) return { data: {}, errors: [] };
  const res = await fetch(`/api/stocktwits?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) {
    return { data: {}, errors: symbols };
  }
  return res.json();
}
