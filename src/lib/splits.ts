export interface SplitEvent {
  date: string;
  ratio: number;
}

export async function fetchSplitHistory(
  symbols: string[]
): Promise<{ splits: Record<string, SplitEvent[]>; errors: string[] }> {
  if (symbols.length === 0) return { splits: {}, errors: [] };
  const res = await fetch(`/api/splits?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) {
    return { splits: {}, errors: symbols };
  }
  return res.json();
}
