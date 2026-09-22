export interface EarningsInfo {
  date: string;
  dateEnd?: string;
}

export async function fetchEarningsDates(
  symbols: string[]
): Promise<{ data: Record<string, EarningsInfo>; errors: string[] }> {
  if (symbols.length === 0) return { data: {}, errors: [] };
  const res = await fetch(`/api/earnings?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) {
    return { data: {}, errors: symbols };
  }
  return res.json();
}
