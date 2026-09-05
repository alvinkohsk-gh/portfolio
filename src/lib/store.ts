import { PortfolioState, PriceInfo, Transaction, WatchlistItem } from "./types";
import { sampleState } from "./sampleData";

const STORAGE_KEY = "portfolio-tracker:v1";

const emptyState: PortfolioState = {
  transactions: [],
  prices: {},
  watchlist: [],
  currency: "USD",
};

let state: PortfolioState = emptyState;
let initialized = false;
const listeners = new Set<() => void>();

function readFromStorage(): PortfolioState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as PortfolioState;
    if (!parsed.transactions || !parsed.prices || !parsed.watchlist) return emptyState;
    return parsed;
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

export function replaceState(next: PortfolioState) {
  commit(next);
}

export function resetToSample() {
  commit(sampleState);
}

export function clearAll() {
  commit({ transactions: [], prices: {}, watchlist: [], currency: state.currency });
}
