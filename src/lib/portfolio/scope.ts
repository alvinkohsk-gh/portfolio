import { ALL_PORTFOLIOS, PortfolioState } from "../types";

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

/** A portfolio's display currency, falling back to the global default
 * (state.currency) when it has none of its own set. */
export function currencyForPortfolio(state: PortfolioState, portfolioId: string): string {
  return state.portfolios.find((p) => p.id === portfolioId)?.currency ?? state.currency;
}

/** The currency to format amounts in for whatever's currently selected in
 * the portfolio switcher - the global default while viewing "All
 * Portfolios" (since amounts from differently-labeled portfolios are being
 * combined anyway), or that one portfolio's own currency otherwise. */
export function activeCurrency(state: PortfolioState): string {
  if (state.activePortfolioId === ALL_PORTFOLIOS) return state.currency;
  return currencyForPortfolio(state, state.activePortfolioId);
}

export function allSymbols(state: PortfolioState): string[] {
  const set = new Set<string>();
  for (const t of state.transactions) set.add(t.symbol);
  for (const w of state.watchlist) set.add(w.symbol);
  return [...set].sort();
}

export function symbolNames(state: PortfolioState): Record<string, string> {
  const names: Record<string, string> = {};
  for (const t of [...state.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (t.name) names[t.symbol] = t.name;
  }
  for (const w of state.watchlist) {
    if (w.name && !names[w.symbol]) names[w.symbol] = w.name;
  }
  return names;
}
