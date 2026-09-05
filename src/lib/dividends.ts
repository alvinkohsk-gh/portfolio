import { DividendEvent } from "./types";

export async function fetchDividendHistory(
  symbols: string[]
): Promise<{ dividends: Record<string, DividendEvent[]>; errors: string[] }> {
  if (symbols.length === 0) return { dividends: {}, errors: [] };
  const res = await fetch(`/api/dividends?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) {
    return { dividends: {}, errors: symbols };
  }
  return res.json();
}
