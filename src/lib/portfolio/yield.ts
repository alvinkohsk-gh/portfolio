import { Holding, PortfolioState } from "../types";

export interface YieldMetrics {
  /** Trailing-12-month dividends over current market value. */
  currentYield: number;
  /** Trailing-12-month dividends over cost basis. */
  costYield: number;
  /** Each holding's latest dividend payment, annualized by how many times
   * it paid in the trailing 12 months, over current market value - a
   * forward-looking estimate using the latest payment rate rather than
   * the actual trailing total (which mixes in older, possibly different,
   * payment amounts). */
  projectedYield: number;
}

const TRAILING_YIELD_DAYS = 365;

/** Yield is computed only from manually-logged DIVIDEND transactions (not
 * the dividendHistory-estimated portion of Holding.dividends), since
 * turning per-share historical events into a trailing-12-month total needs
 * the same quantity-at-date weighting computeHoldings already does for the
 * lifetime figure, which is more machinery than a supplementary stat line
 * warrants. It does still apply that weighting to exclude any payment from
 * a stretch when the position was fully closed - e.g. bought, sold out
 * entirely, then reopened later - so a dividend paid while you didn't hold
 * the stock is never counted, even though the symbol is open again now. */
export function computeYieldMetrics(state: PortfolioState, holdings: Holding[]): YieldMetrics {
  const openHoldings = holdings.filter((h) => h.quantity > 0);
  const totalValue = openHoldings.reduce((s, h) => s + h.marketValue, 0);
  const totalCost = openHoldings.reduce((s, h) => s + h.costBasis, 0);
  if (totalValue === 0) return { currentYield: 0, costYield: 0, projectedYield: 0 };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TRAILING_YIELD_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const openSymbols = new Set(openHoldings.map((h) => h.symbol));

  // Per-symbol running-quantity timeline from this symbol's own Buy/Sell
  // history, so a dividend can be checked against how many shares were
  // actually held on its payment date.
  const timelines = new Map<string, { date: string; qty: number }[]>();
  const sortedTrades = [...state.transactions]
    .filter((t) => (t.type === "BUY" || t.type === "SELL") && openSymbols.has(t.symbol))
    .sort((a, b) => a.date.localeCompare(b.date));
  const running = new Map<string, number>();
  for (const t of sortedTrades) {
    const prev = running.get(t.symbol) ?? 0;
    const next = t.type === "BUY" ? prev + t.quantity : prev - t.quantity;
    running.set(t.symbol, next);
    const list = timelines.get(t.symbol) ?? [];
    list.push({ date: t.date, qty: next });
    timelines.set(t.symbol, list);
  }

  function heldOn(symbol: string, date: string): boolean {
    const points = timelines.get(symbol);
    if (!points) return false;
    let qty = 0;
    for (const p of points) {
      if (p.date > date) break;
      qty = p.qty;
    }
    return qty > 0;
  }

  const paymentsBySymbol = new Map<string, { date: string; amount: number }[]>();
  for (const t of state.transactions) {
    if (t.type !== "DIVIDEND" || !openSymbols.has(t.symbol)) continue;
    if (!heldOn(t.symbol, t.date)) continue;
    const list = paymentsBySymbol.get(t.symbol) ?? [];
    list.push({ date: t.date, amount: t.price });
    paymentsBySymbol.set(t.symbol, list);
  }

  let trailingTotal = 0;
  let projectedTotal = 0;
  for (const payments of paymentsBySymbol.values()) {
    const trailing = payments.filter((p) => p.date >= cutoffStr);
    trailingTotal += trailing.reduce((s, p) => s + p.amount, 0);
    if (trailing.length > 0) {
      const latest = [...payments].sort((a, b) => b.date.localeCompare(a.date))[0];
      projectedTotal += latest.amount * trailing.length;
    }
  }

  return {
    currentYield: (trailingTotal / totalValue) * 100,
    costYield: totalCost > 0 ? (trailingTotal / totalCost) * 100 : 0,
    projectedYield: (projectedTotal / totalValue) * 100,
  };
}
