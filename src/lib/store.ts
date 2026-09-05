import {
  ALL_PORTFOLIOS,
  Portfolio,
  PortfolioState,
  PriceInfo,
  Transaction,
  WatchlistItem,
} from "./types";
import { sampleState } from "./sampleData";

const STORAGE_KEY = "portfolio-tracker:v1";
const DEFAULT_PORTFOLIO_ID = "default";

function defaultPortfolios(): Portfolio[] {
  return [{ id: DEFAULT_PORTFOLIO_ID, name: "My Portfolio" }];
}

const emptyState: PortfolioState = {
  transactions: [],
  prices: {},
  watchlist: [],
  currency: "USD",
  portfolios: defaultPortfolios(),
  activePortfolioId: ALL_PORTFOLIOS,
};

let state: PortfolioState = emptyState;
let initialized = false;
const listeners = new Set<() => void>();

/** Backfills fields introduced after data may already have been saved to
 * localStorage, so older saves keep working instead of getting discarded.
 * Also used to normalize manually-imported JSON exports for the same
 * reason (see Settings > Import data). */
export function migrate(parsed: PortfolioState): PortfolioState {
  const portfolios =
    Array.isArray(parsed.portfolios) && parsed.portfolios.length > 0
      ? parsed.portfolios
      : defaultPortfolios();
  const fallbackId = portfolios[0].id;

  return {
    ...parsed,
    portfolios,
    activePortfolioId: parsed.activePortfolioId ?? ALL_PORTFOLIOS,
    transactions: parsed.transactions.map((t) =>
      t.portfolioId ? t : { ...t, portfolioId: fallbackId }
    ),
  };
}

function readFromStorage(): PortfolioState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as PortfolioState;
    if (!parsed.transactions || !parsed.prices || !parsed.watchlist) return emptyState;
    return migrate(parsed);
  } catch {
    return emptyState;
  }
}

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  state = readFromStorage();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private mode, quota) - fail silently
  }
}

function commit(next: PortfolioState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): PortfolioState {
  ensureInitialized();
  return state;
}

export function getServerSnapshot(): PortfolioState {
  return emptyState;
}

export function addTransaction(tx: Omit<Transaction, "id">) {
  const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  commit({ ...state, transactions: [...state.transactions, { ...tx, id }] });
}

export function updateTransaction(id: string, tx: Omit<Transaction, "id">) {
  commit({
    ...state,
    transactions: state.transactions.map((t) => (t.id === id ? { ...tx, id } : t)),
  });
}

export function deleteTransaction(id: string) {
  commit({ ...state, transactions: state.transactions.filter((t) => t.id !== id) });
}

export function setPrice(symbol: string, price: number) {
  commit({
    ...state,
    prices: {
      ...state.prices,
      [symbol]: {
        symbol,
        price,
        previousClose: state.prices[symbol]?.previousClose,
        currency: state.prices[symbol]?.currency ?? state.currency,
        updatedAt: new Date().toISOString(),
        source: "manual",
      },
    },
  });
}

export function setLivePrices(
  quotes: Record<string, { price: number; previousClose?: number; currency?: string }>
) {
  const nextPrices: Record<string, PriceInfo> = { ...state.prices };
  for (const [symbol, q] of Object.entries(quotes)) {
    nextPrices[symbol] = {
      symbol,
      price: q.price,
      previousClose: q.previousClose,
      currency: q.currency ?? nextPrices[symbol]?.currency ?? state.currency,
      updatedAt: new Date().toISOString(),
      source: "live",
    };
  }
  commit({ ...state, prices: nextPrices });
}

export function addWatchlistItem(item: WatchlistItem) {
  if (state.watchlist.some((w) => w.symbol === item.symbol)) return;
  commit({ ...state, watchlist: [...state.watchlist, item] });
}

export function removeWatchlistItem(symbol: string) {
  commit({ ...state, watchlist: state.watchlist.filter((w) => w.symbol !== symbol) });
}

export function setCurrency(currency: string) {
  commit({ ...state, currency });
}

export function addPortfolio(name: string): string {
  const id = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  commit({ ...state, portfolios: [...state.portfolios, { id, name }] });
  return id;
}

export function renamePortfolio(id: string, name: string) {
  commit({
    ...state,
    portfolios: state.portfolios.map((p) => (p.id === id ? { ...p, name } : p)),
  });
}

/** No-ops if this is the last remaining portfolio - there must always be at
 * least one to assign transactions to. */
export function deletePortfolio(id: string) {
  if (state.portfolios.length <= 1) return;
  commit({
    ...state,
    portfolios: state.portfolios.filter((p) => p.id !== id),
    transactions: state.transactions.filter((t) => t.portfolioId !== id),
    activePortfolioId: state.activePortfolioId === id ? ALL_PORTFOLIOS : state.activePortfolioId,
  });
}

export function setActivePortfolio(id: string) {
  commit({ ...state, activePortfolioId: id });
}

export function replaceState(next: PortfolioState) {
  commit(next);
}

export function resetToSample() {
  commit(sampleState);
}

export function clearAll() {
  commit({
    transactions: [],
    prices: {},
    watchlist: [],
    currency: state.currency,
    portfolios: defaultPortfolios(),
    activePortfolioId: ALL_PORTFOLIOS,
  });
}
