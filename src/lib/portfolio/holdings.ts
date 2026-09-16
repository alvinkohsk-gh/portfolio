import { DividendEvent, Holding, PortfolioState } from "../types";

/** Below this, a running share count is treated as exactly zero rather than
 * a tiny floating-point residue from summing/subtracting fractional shares
 * in a different order than they were bought. */
const QUANTITY_EPSILON = 1e-6;

interface RunningLot {
  quantity: number;
  avgCost: number;
  realizedGain: number;
  /** Portion of realizedGain from closing trades dated today - included in
   * realizedGain, broken out here so "today's P&L" can include gains/losses
   * locked in today alongside the unrealized change in open positions. */
  realizedGainToday: number;
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

/** The currency a symbol's live quote should be in, based on the exchange
 * suffix convention this app understands (see api/quote/route.ts's bare
 * ticker -> .SI fallback). Undefined for symbols this app has no
 * expectation for (any other exchange suffix), which just skips the
 * mismatch check rather than flagging a false positive. */
function expectedCurrency(symbol: string): string | undefined {
  if (symbol.toUpperCase().endsWith(".SI")) return "SGD";
  if (!symbol.includes(".")) return "USD";
  return undefined;
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

/** Computes current holdings from the full transaction history using the
 * average-cost method (the same approach most simple trackers use). */
export function computeHoldings(state: PortfolioState): Holding[] {
  const bySymbol = new Map<string, RunningLot>();
  const timelines = new Map<string, QuantityPoint[]>();
  const manualDividendDates = new Map<string, Set<string>>();
  const sorted = [...state.transactions].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const tx of sorted) {
    const lot = bySymbol.get(tx.symbol) ?? {
      quantity: 0,
      avgCost: 0,
      realizedGain: 0,
      realizedGainToday: 0,
      dividends: 0,
      estimatedDividends: 0,
      name: tx.name,
    };
    if (tx.name) lot.name = tx.name;

    if (tx.type === "BUY") {
      const fees = tx.fees ?? 0;
      if (lot.quantity < 0) {
        // Covering an existing short: shares up to the short size close it
        // out at a gain/loss versus the short's average sale price; any
        // excess opens a new long position.
        const coverQty = Math.min(tx.quantity, -lot.quantity);
        const coverGain = coverQty * (lot.avgCost - tx.price) - fees;
        lot.realizedGain += coverGain;
        if (tx.date === todayStr) lot.realizedGainToday += coverGain;
        lot.quantity += coverQty;
        const remaining = tx.quantity - coverQty;
        if (remaining > 0) {
          lot.avgCost = tx.price;
          lot.quantity = remaining;
          if (!lot.firstBuyDate) lot.firstBuyDate = tx.date;
        } else if (Math.abs(lot.quantity) < QUANTITY_EPSILON) {
          lot.quantity = 0;
          lot.avgCost = 0;
        }
      } else {
        const totalCostBefore = lot.quantity * lot.avgCost;
        const newQuantity = lot.quantity + tx.quantity;
        const addedCost = tx.quantity * tx.price + fees;
        lot.avgCost = newQuantity > 0 ? (totalCostBefore + addedCost) / newQuantity : 0;
        lot.quantity = newQuantity;
        if (!lot.firstBuyDate) lot.firstBuyDate = tx.date;
      }
      pushQuantityPoint(timelines, tx.symbol, tx.date, lot.quantity);
    } else if (tx.type === "SELL") {
      const fees = tx.fees ?? 0;
      if (lot.quantity > 0) {
        const sellQty = Math.min(tx.quantity, lot.quantity);
        const sellGain = sellQty * (tx.price - lot.avgCost) - fees;
        lot.realizedGain += sellGain;
        if (tx.date === todayStr) lot.realizedGainToday += sellGain;
        lot.quantity -= sellQty;
        const remaining = tx.quantity - sellQty;
        if (remaining > 0) {
          // Selling past the existing long opens a short with the rest.
          lot.avgCost = tx.price;
          lot.quantity = -remaining;
        } else if (Math.abs(lot.quantity) < QUANTITY_EPSILON) {
          // Selling down a position built from many fractional-share buys,
          // via a different grouping of sells than it was bought in, can
          // leave a tiny floating-point residue (e.g. 1e-14) instead of an
          // exact zero - which would otherwise still read as an open
          // position with "0.0000" shares.
          lot.quantity = 0;
          lot.avgCost = 0;
        }
      } else {
        // Extending (or opening) a short position: track the
        // volume-weighted average sale price of the short.
        const shortQtyBefore = -lot.quantity;
        const proceedsBefore = shortQtyBefore * lot.avgCost;
        const newShortQty = shortQtyBefore + tx.quantity;
        const addedProceeds = tx.quantity * tx.price - fees;
        lot.avgCost = newShortQty > 0 ? (proceedsBefore + addedProceeds) / newShortQty : 0;
        lot.quantity = -newShortQty;
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

    if (lot.quantity === 0 && lot.realizedGain === 0 && lot.dividends === 0) continue;

    const priceInfo = state.prices[symbol];
    const currentPrice = priceInfo?.price ?? lot.avgCost;
    const previousClose = priceInfo?.previousClose;
    const costBasis = lot.quantity * lot.avgCost;
    const marketValue = lot.quantity * currentPrice;
    const gain = marketValue - costBasis;
    const gainPct = costBasis !== 0 ? (gain / Math.abs(costBasis)) * 100 : 0;
    const dayChange =
      previousClose != null ? lot.quantity * (currentPrice - previousClose) : 0;
    const dayChangePct =
      previousClose != null && previousClose > 0
        ? ((currentPrice - previousClose) / previousClose) * 100
        : 0;
    const totalReturn = gain + lot.dividends;
    const totalReturnPct = costBasis !== 0 ? (totalReturn / Math.abs(costBasis)) * 100 : 0;
    const dividendAdjustedAvgCost =
      lot.quantity > 0 ? lot.avgCost - lot.dividends / lot.quantity : lot.avgCost;
    const priceCurrency = priceInfo?.currency;
    const expected = expectedCurrency(symbol);
    const priceCurrencyMismatch =
      priceCurrency != null && expected != null && priceCurrency.toUpperCase() !== expected;
    const fiftyTwoWeekLow = priceInfo?.fiftyTwoWeekLow;
    const fiftyTwoWeekHigh = priceInfo?.fiftyTwoWeekHigh;
    const fiftyTwoWeekPct =
      fiftyTwoWeekLow != null && fiftyTwoWeekHigh != null && fiftyTwoWeekHigh > fiftyTwoWeekLow
        ? Math.max(
            0,
            Math.min(
              100,
              ((currentPrice - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100
            )
          )
        : undefined;

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
      fiftyTwoWeekLow,
      fiftyTwoWeekHigh,
      fiftyTwoWeekPct,
      marketValue,
      gain,
      gainPct,
      dayChange,
      dayChangePct,
      weight: 0, // filled in below
      realizedGain: lot.realizedGain,
      realizedGainToday: lot.realizedGainToday,
      dividends: lot.dividends,
      estimatedDividends: lot.estimatedDividends,
      totalReturn,
      totalReturnPct,
      dividendAdjustedAvgCost,
      firstBuyDate: lot.firstBuyDate,
      priceCurrency,
      priceCurrencyMismatch,
    });
  }

  // Weight is "share of the (long) portfolio" - only open long positions
  // count toward the denominator, matching what the allocation chart and
  // sector concentration actually display (both filter to quantity > 0).
  // Including short positions here would drag the total down by their
  // negative market value and throw off every other holding's percentage.
  const totalValue = holdings
    .filter((h) => h.quantity > 0)
    .reduce((sum, h) => sum + h.marketValue, 0);
  for (const h of holdings) {
    h.weight = totalValue > 0 && h.quantity > 0 ? (h.marketValue / totalValue) * 100 : 0;
  }

  return holdings.sort((a, b) => b.marketValue - a.marketValue);
}
