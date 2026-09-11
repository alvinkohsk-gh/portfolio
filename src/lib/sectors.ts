export async function fetchSectors(
  symbols: string[]
): Promise<{ sectors: Record<string, string>; errors: string[] }> {
  if (symbols.length === 0) return { sectors: {}, errors: [] };
  const res = await fetch(`/api/sector?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) {
    return { sectors: {}, errors: symbols };
  }
  return res.json();
}
