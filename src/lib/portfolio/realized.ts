import { PortfolioState, Transaction } from "../types";

/** One closed-lot realization event: a SELL against an existing long, or a
 * BUY that covers an existing short. Unlike Holding.realizedGain (a running
 * total per symbol), this captures each individual closing trade so a
 * history of "what did I actually lock in, and when" can be shown. */
export interface RealizedEvent {
  id: string;
  portfolioId: string;
  symbol: string;
  name?: string;
  date: string;
  /** Direction of the position being closed. */
  side: "LONG" | "SHORT";
  /** How many shares this closing trade accounted for (always positive). */
  quantity: number;
  /** Average cost/short-sale price of the position being closed. */
  entryPrice: number;
  /** Price of the closing trade itself. */
  exitPrice: number;
  fees: number;
  gain: number;
}

interface RunningLot {
  quantity: number;
  avgCost: number;
  name?: string;
}

/** Walks the full transaction history (same average-cost approach as
 * computeHoldings) tracking one running lot per portfolio+symbol, emitting
 * a RealizedEvent every time a trade fully or partially closes a position. */
export function computeRealizedEvents(state: PortfolioState): RealizedEvent[] {
  const bySymbol = new Map<string, RunningLot>();
  const sorted = [...state.transactions].sort((a, b) => a.date.localeCompare(b.date));
  const events: RealizedEvent[] = [];

  function key(t: Transaction) {
    return `${t.portfolioId}|${t.symbol}`;
  }

  for (const tx of sorted) {
    const lot = bySymbol.get(key(tx)) ?? { quantity: 0, avgCost: 0, name: tx.name };
    if (tx.name) lot.name = tx.name;

    if (tx.type === "BUY") {
      const fees = tx.fees ?? 0;
      if (lot.quantity < 0) {
        const coverQty = Math.min(tx.quantity, -lot.quantity);
        const gain = coverQty * (lot.avgCost - tx.price) - fees;
        events.push({
          id: `${tx.id}-cover`,
          portfolioId: tx.portfolioId,
          symbol: tx.symbol,
          name: lot.name,
          date: tx.date,
          side: "SHORT",
          quantity: coverQty,
          entryPrice: lot.avgCost,
          exitPrice: tx.price,
          fees,
          gain,
        });
        lot.quantity += coverQty;
        const remaining = tx.quantity - coverQty;
        if (remaining > 0) {
          lot.avgCost = tx.price;
          lot.quantity = remaining;
        } else if (Math.abs(lot.quantity) < 1e-6) {
          lot.quantity = 0;
          lot.avgCost = 0;
        }
      } else {
        const totalCostBefore = lot.quantity * lot.avgCost;
        const newQuantity = lot.quantity + tx.quantity;
        const addedCost = tx.quantity * tx.price + fees;
        lot.avgCost = newQuantity > 0 ? (totalCostBefore + addedCost) / newQuantity : 0;
        lot.quantity = newQuantity;
      }
    } else if (tx.type === "SELL") {
      const fees = tx.fees ?? 0;
      if (lot.quantity > 0) {
        const sellQty = Math.min(tx.quantity, lot.quantity);
        const gain = sellQty * (tx.price - lot.avgCost) - fees;
        events.push({
          id: `${tx.id}-sell`,
          portfolioId: tx.portfolioId,
          symbol: tx.symbol,
          name: lot.name,
          date: tx.date,
          side: "LONG",
          quantity: sellQty,
          entryPrice: lot.avgCost,
          exitPrice: tx.price,
          fees,
          gain,
        });
        lot.quantity -= sellQty;
        const remaining = tx.quantity - sellQty;
        if (remaining > 0) {
          lot.avgCost = tx.price;
          lot.quantity = -remaining;
        } else if (Math.abs(lot.quantity) < 1e-6) {
          lot.quantity = 0;
          lot.avgCost = 0;
        }
      } else {
        const shortQtyBefore = -lot.quantity;
        const proceedsBefore = shortQtyBefore * lot.avgCost;
        const newShortQty = shortQtyBefore + tx.quantity;
        const addedProceeds = tx.quantity * tx.price - fees;
        lot.avgCost = newShortQty > 0 ? (proceedsBefore + addedProceeds) / newShortQty : 0;
        lot.quantity = -newShortQty;
      }
    }

    bySymbol.set(key(tx), lot);
  }

  return events.sort((a, b) => b.date.localeCompare(a.date));
}

export interface RealizedStats {
  winCount: number;
  lossCount: number;
  breakEvenCount: number;
  /** Wins / (wins + losses) as a 0-100 percentage - breakeven closes are
   * excluded from both sides, matching the usual trading convention. */
  winRatePct: number | undefined;
  avgWin: number | undefined;
  avgLoss: number | undefined;
  biggestWin: number | undefined;
  biggestLoss: number | undefined;
  /** Gross wins / |gross losses|. Undefined with no losses (rather than
   * showing a misleading Infinity). */
  profitFactor: number | undefined;
}

/** Trade-level win/loss stats over a set of realized events - independent of
 * computeSummary's totalRealizedGain, which only tracks the dollar total. */
export function computeRealizedStats(events: RealizedEvent[]): RealizedStats {
  const wins = events.filter((e) => e.gain > 0);
  const losses = events.filter((e) => e.gain < 0);
  const breakEvenCount = events.length - wins.length - losses.length;

  const grossWin = wins.reduce((sum, e) => sum + e.gain, 0);
  const grossLoss = losses.reduce((sum, e) => sum + e.gain, 0);

  return {
    winCount: wins.length,
    lossCount: losses.length,
    breakEvenCount,
    winRatePct:
      wins.length + losses.length > 0 ? (wins.length / (wins.length + losses.length)) * 100 : undefined,
    avgWin: wins.length > 0 ? grossWin / wins.length : undefined,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : undefined,
    biggestWin: wins.length > 0 ? Math.max(...wins.map((e) => e.gain)) : undefined,
    biggestLoss: losses.length > 0 ? Math.min(...losses.map((e) => e.gain)) : undefined,
    profitFactor: grossLoss < 0 ? grossWin / Math.abs(grossLoss) : undefined,
  };
}
