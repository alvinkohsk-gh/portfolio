import { ALL_PORTFOLIOS, DividendEvent, Holding, PortfolioState, PortfolioSummary } from "./types";
import { applyCorporateActions, resolveFinalSymbol } from "./corporateActions";

interface RunningLot {
  quantity: number;
  avgCost: number;
  realizedGain: number;
  dividends: number;
  estimatedDividends: number;
  name?: string;
  firstBuyDate?: string;
}

interface QuantityPoint {
  date: string;
  quantity: number;
}

/** Given how many shares were held on each date (built from BUY/SELL
 * history) and a symbol's historical per-share dividend payments, estimates
 * the dividend income the holder would have earned - filling in for periods
 * where the user hasn't manually logged a DIVIDEND transaction. A payment
 * that lands on a date already covered by a manual entry is skipped so it
 * isn't counted twice. */
function estimateDividendIncome(
  timeline: QuantityPoint[],
  events: DividendEvent[],
  manualDates: Set<string>
): number {
  if (timeline.length === 0 || events.length === 0) return 0;
  let total = 0;
  for (const event of events) {
    if (manualDates.has(event.date)) continue;
    let quantity = 0;
    for (const point of timeline) {
      if (point.date > event.date) break;
      quantity = point.quantity;
    }
    if (quantity > 0) total += quantity * event.amount;
  }
  return total;
}

/** Computes current holdings from the full transaction history using the
 * average-cost method (the same approach most simple trackers use). */
export function computeHoldings(state: PortfolioState): Holding[] {
  const bySymbol = new Map<string, RunningLot>();
  const timelines = new Map<string, QuantityPoint[]>();
  const manualDividendDates = new Map<string, Set<string>>();
  const adjusted = applyCorporateActions(state.transactions, state.corporateActions);
  const sorted = [...adjusted].sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of sorted) {
    const lot = bySymbol.get(tx.symbol) ?? {
      quantity: 0,
      avgCost: 0,
      realizedGain: 0,
      dividends: 0,
      estimatedDividends: 0,
      name: tx.name,
    };
    if (tx.name) lot.name = tx.name;

    if (tx.type === "BUY") {
      const fees = tx.fees ?? 0;
      const totalCostBefore = lot.quantity * lot.avgCost;
      const newQuantity = lot.quantity + tx.quantity;
      const addedCost = tx.quantity * tx.price + fees;
      lot.avgCost = newQuantity > 0 ? (totalCostBefore + addedCost) / newQuantity : 0;
      lot.quantity = newQuantity;
      if (!lot.firstBuyDate) lot.firstBuyDate = tx.date;
      pushQuantityPoint(timelines, tx.symbol, tx.date, lot.quantity);
    } else if (tx.type === "SELL") {
      const fees = tx.fees ?? 0;
      const sellQty = Math.min(tx.quantity, lot.quantity);
      lot.realizedGain += sellQty * (tx.price - lot.avgCost) - fees;
      lot.quantity -= sellQty;
      if (lot.quantity <= 0) {
        lot.quantity = 0;
        lot.avgCost = 0;
      }
      pushQuantityPoint(timelines, tx.symbol, tx.date, lot.quantity);
    } else if (tx.type === "DIVIDEND") {
      lot.dividends += tx.price;
      const dates = manualDividendDates.get(tx.symbol) ?? new Set<string>();
      dates.add(tx.date);
      manualDividendDates.set(tx.symbol, dates);
    }

    bySymbol.set(tx.symbol, lot);
  }

  const holdings: Holding[] = [];
  for (const [symbol, lot] of bySymbol.entries()) {
    const history = state.dividendHistory[symbol];
    if (history && history.length > 0) {
      lot.estimatedDividends = estimateDividendIncome(
        timelines.get(symbol) ?? [],
        history,
        manualDividendDates.get(symbol) ?? new Set()
      );
      lot.dividends += lot.estimatedDividends;
    }

    if (lot.quantity <= 0 && lot.realizedGain === 0 && lot.dividends === 0) continue;

    const priceInfo = state.prices[symbol];
    const currentPrice = priceInfo?.price ?? lot.avgCost;
    const previousClose = priceInfo?.previousClose;
    const costBasis = lot.quantity * lot.avgCost;
    const marketValue = lot.quantity * currentPrice;
    const gain = marketValue - costBasis;
    const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
    const dayChange =
      previousClose != null ? lot.quantity * (currentPrice - previousClose) : 0;
    const dayChangePct =
      previousClose != null && previousClose > 0
        ? ((currentPrice - previousClose) / previousClose) * 100
        : 0;
    const totalReturn = gain + lot.dividends;
    const totalReturnPct = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0;
    const dividendAdjustedAvgCost =
      lot.quantity > 0 ? lot.avgCost - lot.dividends / lot.quantity : lot.avgCost;

    holdings.push({
      symbol,
      name: lot.name,
      quantity: lot.quantity,
      avgCost: lot.avgCost,
      costBasis,
      currentPrice,
      priceUpdatedAt: priceInfo?.updatedAt,
      priceSource: priceInfo?.source,
      previousClose,
      marketValue,
      gain,
      gainPct,
      dayChange,
      dayChangePct,
      weight: 0, // filled in below
      realizedGain: lot.realizedGain,
      dividends: lot.dividends,
      estimatedDividends: lot.estimatedDividends,
      totalReturn,
      totalReturnPct,
      dividendAdjustedAvgCost,
      firstBuyDate: lot.firstBuyDate,
    });
  }

  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  for (const h of holdings) {
    h.weight = totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0;
  }

  return holdings.sort((a, b) => b.marketValue - a.marketValue);
}

function pushQuantityPoint(
  timelines: Map<string, QuantityPoint[]>,
  symbol: string,
  date: string,
  quantity: number
) {
  const list = timelines.get(symbol) ?? [];
  list.push({ date, quantity });
  timelines.set(symbol, list);
}

export function computeSummary(holdings: Holding[]): PortfolioSummary {
  const openHoldings = holdings.filter((h) => h.quantity > 0);
  const totalValue = openHoldings.reduce((s, h) => s + h.marketValue, 0);
  const totalCost = openHoldings.reduce((s, h) => s + h.costBasis, 0);
  const dayChange = openHoldings.reduce((s, h) => s + h.dayChange, 0);
  const previousTotal = totalValue - dayChange;
  const totalRealizedGain = holdings.reduce((s, h) => s + h.realizedGain, 0);
  const totalDividends = holdings.reduce((s, h) => s + h.dividends, 0);

  return {
    totalValue,
    totalCost,
    totalGain: totalValue - totalCost,
    totalGainPct: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
    dayChange,
    dayChangePct: previousTotal > 0 ? (dayChange / previousTotal) * 100 : 0,
    totalRealizedGain,
    totalDividends,
    holdingsCount: openHoldings.length,
  };
}

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
  const adjusted = applyCorporateActions(state.transactions, state.corporateActions);
  const sorted = [...adjusted]
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
      qtyBySymbol.set(tx.symbol, Math.max(0, qty - tx.quantity));
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

/** Returns a copy of state scoped to one portfolio (or the state as-is for
 * ALL_PORTFOLIOS), so the existing compute* functions don't need to know
 * about portfolios at all - they just see a smaller transaction list. */
export function scopedToPortfolio(state: PortfolioState, portfolioId: string): PortfolioState {
  if (portfolioId === ALL_PORTFOLIOS) return state;
  return {
    ...state,
    transactions: state.transactions.filter((t) => t.portfolioId === portfolioId),
  };
}

export function allSymbols(state: PortfolioState): string[] {
  const set = new Set<string>();
  for (const t of state.transactions) {
    set.add(resolveFinalSymbol(t.symbol, t.date, state.corporateActions));
  }
  for (const w of state.watchlist) set.add(w.symbol);
  return [...set].sort();
}

export function symbolNames(state: PortfolioState): Record<string, string> {
  const names: Record<string, string> = {};
  for (const t of [...state.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (t.name) names[resolveFinalSymbol(t.symbol, t.date, state.corporateActions)] = t.name;
  }
  for (const w of state.watchlist) {
    if (w.name && !names[w.symbol]) names[w.symbol] = w.name;
  }
  return names;
}
