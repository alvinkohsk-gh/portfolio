import { Holding } from "../types";

export interface RiskMetrics {
  /** Weighted-average % distance of current price below each holding's
   * 52-week high, weighted by portfolio weight - a proxy for "how far is
   * the portfolio sitting below its recent peak" (a live drawdown-from-high,
   * not a historical daily-NAV max drawdown, which this app has no data
   * for since it never fetches historical portfolio value). Always <= 0. */
  distanceFromHighPct: number | undefined;
  /** Weighted-average 52-week high/low range as a % of the high, weighted
   * by portfolio weight - a rough volatility proxy usable without any
   * historical price series. */
  rangeWidthPct: number | undefined;
  /** How many open long holdings had both 52-week bounds available (from a
   * live quote) and therefore contributed to the metrics above. */
  coveredCount: number;
  /** Open long holdings excluded from both metrics for lacking bounds. */
  uncoveredCount: number;
  /** The single largest open long holding by portfolio weight - a
   * concentration risk distinct from sector concentration (already flagged
   * elsewhere by SectorConcentration): even a well-diversified-by-sector
   * portfolio can still be dominated by one stock. Undefined with no open
   * holdings. */
  largestPosition: { symbol: string; weightPct: number } | undefined;
}

/** Above this weight in a single holding, flag it as a concentration risk -
 * same threshold SectorConcentration uses for a single sector. */
export const POSITION_CONCENTRATION_THRESHOLD = 25;

/** Portfolio-level risk proxies derived from each holding's already-fetched
 * 52-week high/low (Holding.fiftyTwoWeekLow/High) - no historical daily
 * price series is available anywhere in this app, so a true max-drawdown
 * or realized-volatility figure isn't computable; these are the closest
 * honest substitutes using data already on hand. */
export function computeRiskMetrics(holdings: Holding[]): RiskMetrics {
  const open = holdings.filter((h) => h.quantity > 0);
  const covered = open.filter((h) => h.fiftyTwoWeekLow != null && h.fiftyTwoWeekHigh != null);
  const totalWeight = covered.reduce((sum, h) => sum + h.weight, 0);

  const largest = open.reduce<Holding | undefined>(
    (max, h) => (max == null || h.weight > max.weight ? h : max),
    undefined
  );
  const largestPosition = largest ? { symbol: largest.symbol, weightPct: largest.weight } : undefined;

  if (covered.length === 0 || totalWeight === 0) {
    return {
      distanceFromHighPct: undefined,
      rangeWidthPct: undefined,
      coveredCount: covered.length,
      uncoveredCount: open.length - covered.length,
      largestPosition,
    };
  }

  let distanceSum = 0;
  let rangeSum = 0;
  for (const h of covered) {
    const high = h.fiftyTwoWeekHigh!;
    const low = h.fiftyTwoWeekLow!;
    const distancePct = high > 0 ? ((h.currentPrice - high) / high) * 100 : 0;
    const rangePct = high > 0 ? ((high - low) / high) * 100 : 0;
    // Re-normalized to the covered subset's weight, so a few holdings
    // missing bounds don't silently drag the average toward zero.
    distanceSum += distancePct * (h.weight / totalWeight);
    rangeSum += rangePct * (h.weight / totalWeight);
  }

  return {
    distanceFromHighPct: distanceSum,
    rangeWidthPct: rangeSum,
    coveredCount: covered.length,
    uncoveredCount: open.length - covered.length,
    largestPosition,
  };
}
