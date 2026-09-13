import { Holding, PortfolioState } from "../types";

export interface PerformancePoint {
  date: string;
  invested: number;
  marketValueAtCurrentPrices: number;
}

/** Builds a simple invested-capital-over-time series, plus what that
 * cumulative position would be worth at today's prices. This does not
 * require historical price data, which the app does not fetch. */
export function computePerformanceSeries(
  state: PortfolioState,
  holdings: Holding[]
): PerformancePoint[] {
  const priceBySymbol = new Map(holdings.map((h) => [h.symbol, h.currentPrice]));
  const sorted = [...state.transactions]
    .filter((t) => t.type !== "DIVIDEND")
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) return [];

  const qtyBySymbol = new Map<string, number>();
  let invested = 0;
  const points: PerformancePoint[] = [];

  const pushPoint = (date: string) => {
    let marketValueAtCurrentPrices = 0;
    for (const [symbol, qty] of qtyBySymbol.entries()) {
      const price = priceBySymbol.get(symbol) ?? 0;
      marketValueAtCurrentPrices += qty * price;
    }
    points.push({ date, invested, marketValueAtCurrentPrices });
  };

  for (const tx of sorted) {
    const qty = qtyBySymbol.get(tx.symbol) ?? 0;
    if (tx.type === "BUY") {
      invested += tx.quantity * tx.price + (tx.fees ?? 0);
      qtyBySymbol.set(tx.symbol, qty + tx.quantity);
    } else if (tx.type === "SELL") {
      invested -= tx.quantity * tx.price - (tx.fees ?? 0);
      qtyBySymbol.set(tx.symbol, qty - tx.quantity);
    }
    pushPoint(tx.date);
  }

  // Always end with a "Today" point reflecting current prices.
  const todayStr = new Date().toISOString().slice(0, 10);
  if (points.length === 0 || points[points.length - 1].date !== todayStr) {
    pushPoint(todayStr);
  }

  return points;
}
