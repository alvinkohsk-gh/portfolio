import { CorporateAction, Transaction } from "./types";

/** Walks the split/merger chain for a symbol starting from `date` forward,
 * returning the symbol it resolves to today and the cumulative shares-per-
 * original-share multiplier along the way. Each step finds the next action
 * (chronologically) on the current symbol dated after the cursor, applies
 * its ratio, and - for a MERGER - continues the walk under the new symbol,
 * so a chain of several actions (e.g. a merger followed by a later split)
 * composes correctly. */
function walkForward(
  symbol: string,
  date: string,
  actions: CorporateAction[]
): { symbol: string; multiplier: number } {
  let currentSymbol = symbol;
  let multiplier = 1;
  let cursor = date;

  // Bounded by actions.length so a bad (cyclical) chain can't loop forever.
  for (let i = 0; i < actions.length; i++) {
    const next = actions
      .filter((a) => a.symbol === currentSymbol && a.date > cursor)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!next) break;
    multiplier *= next.ratio;
    cursor = next.date;
    if (next.type === "MERGER") currentSymbol = next.newSymbol;
  }

  return { symbol: currentSymbol, multiplier };
}

/** Resolves what symbol a transaction dated `date` on `symbol` should be
 * grouped under today, after following any merger chain. Used for display
 * (symbol lists, manual price entry) where only the identity matters, not
 * the share-count math. */
export function resolveFinalSymbol(
  symbol: string,
  date: string,
  actions: CorporateAction[]
): string {
  if (actions.length === 0) return symbol;
  return walkForward(symbol, date, actions).symbol;
}

/** Re-expresses each transaction in post-corporate-action terms as of
 * today, without mutating the originals: quantity and price are rescaled
 * by the cumulative split/merger ratio effective between the transaction's
 * date and now, and the symbol is remapped through any merger chain.
 * DIVIDEND rows only get their symbol remapped - `price` there is a total
 * cash amount, not a per-share figure, so it isn't rescaled.
 *
 * A merger's optional cash-in-lieu is folded in as a synthetic DIVIDEND
 * entry on the resulting symbol, sized to the transaction's own quantity.
 * This is an approximation: it doesn't account for shares from that
 * transaction having already been sold before the merger, so it's only
 * exact when the pre-merger position was held through to the merger. */
export function applyCorporateActions(
  transactions: Transaction[],
  actions: CorporateAction[]
): Transaction[] {
  if (actions.length === 0) return transactions;

  const result: Transaction[] = [];
  for (const tx of transactions) {
    const { symbol, multiplier } = walkForward(tx.symbol, tx.date, actions);

    if (tx.type === "DIVIDEND") {
      result.push(symbol === tx.symbol ? tx : { ...tx, symbol });
      continue;
    }

    result.push({
      ...tx,
      symbol,
      quantity: tx.quantity * multiplier,
      price: tx.price / multiplier,
    });

    if (tx.type === "BUY") {
      let cursor = tx.date;
      let currentSymbol = tx.symbol;
      for (let i = 0; i < actions.length; i++) {
        const next = actions
          .filter((a) => a.symbol === currentSymbol && a.date > cursor)
          .sort((a, b) => a.date.localeCompare(b.date))[0];
        if (!next) break;
        cursor = next.date;
        if (next.type === "MERGER") {
          currentSymbol = next.newSymbol;
          if (next.cashPerShare) {
            result.push({
              id: `${tx.id}-cash-${next.id}`,
              portfolioId: tx.portfolioId,
              symbol: currentSymbol,
              type: "DIVIDEND",
              date: next.date,
              quantity: 0,
              price: next.cashPerShare * tx.quantity,
            });
          }
        }
      }
    }
  }
  return result;
}
