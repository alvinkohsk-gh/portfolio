import { Holding } from "../types";

export interface SectorGroup {
  name: string;
  value: number;
  weight: number;
}

/** Label used for an open holding with no sector data cached yet (or none
 * returned by the price provider). */
export const UNKNOWN_SECTOR = "Other";

/** Groups open (long) holdings by sector, summing market value and
 * portfolio weight - shared by the allocation chart's sector view and the
 * sector concentration warning, so both read the same grouping. Sorted by
 * market value, largest first. */
export function groupHoldingsBySector(
  holdings: Holding[],
  sectors: Record<string, string>
): SectorGroup[] {
  const open = holdings.filter((h) => h.quantity > 0);
  const groups = new Map<string, SectorGroup>();
  for (const h of open) {
    const name = sectors[h.symbol] ?? UNKNOWN_SECTOR;
    const g = groups.get(name) ?? { name, value: 0, weight: 0 };
    g.value += h.marketValue;
    g.weight += h.weight;
    groups.set(name, g);
  }
  return [...groups.values()].sort((a, b) => b.value - a.value);
}
