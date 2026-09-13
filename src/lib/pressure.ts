export interface PressureResult {
  buyPct: number;
  classifiedVolume: number;
  barCount: number;
}

export async function fetchPressure(
  symbols: string[]
): Promise<{ pressure: Record<string, PressureResult>; errors: string[] }> {
  if (symbols.length === 0) return { pressure: {}, errors: [] };
  const res = await fetch(`/api/pressure?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) {
    return { pressure: {}, errors: symbols };
  }
  return res.json();
}
