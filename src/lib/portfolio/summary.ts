import { Holding, PortfolioSummary } from "../types";

export function computeSummary(holdings: Holding[]): PortfolioSummary {
  const openHoldings = holdings.filter((h) => h.quantity !== 0);
  const totalValue = openHoldings.reduce((s, h) => s + h.marketValue, 0);
  const totalCost = openHoldings.reduce((s, h) => s + h.costBasis, 0);
  const dayChange = openHoldings.reduce((s, h) => s + h.dayChange, 0);
  const previousTotal = totalValue - dayChange;
  const totalRealizedGain = holdings.reduce((s, h) => s + h.realizedGain, 0);
  const totalRealizedGainToday = holdings.reduce((s, h) => s + h.realizedGainToday, 0);
  const totalDividends = holdings.reduce((s, h) => s + h.dividends, 0);

  return {
    totalValue,
    totalCost,
    totalGain: totalValue - totalCost,
    totalGainPct: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
    dayChange,
    dayChangePct: previousTotal > 0 ? (dayChange / previousTotal) * 100 : 0,
    totalRealizedGain,
    totalRealizedGainToday,
    totalDividends,
    holdingsCount: openHoldings.length,
  };
}
