export interface AnalystInfo {
  recommendationKey?: string;
  recommendationMean?: number;
  targetMeanPrice?: number;
  targetHighPrice?: number;
  targetLowPrice?: number;
  numberOfAnalysts?: number;
  currentPrice?: number;
}

export async function fetchAnalystRatings(
  symbols: string[]
): Promise<{ data: Record<string, AnalystInfo>; errors: string[] }> {
  if (symbols.length === 0) return { data: {}, errors: [] };
  const res = await fetch(`/api/analysts?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) {
    return { data: {}, errors: symbols };
  }
  return res.json();
}
