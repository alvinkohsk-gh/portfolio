import {
  ALL_PORTFOLIOS,
  DividendEvent,
  Portfolio,
  PortfolioState,
  PositionTarget,
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
  dividendHistory: {},
  sectors: {},
  positionTargets: {},
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
    dividendHistory: parsed.dividendHistory ?? {},
    sectors: parsed.sectors ?? {},
    positionTargets: parsed.positionTargets ?? {},
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

function transactionKey(t: Pick<Transaction, "portfolioId" | "symbol" | "type" | "date" | "quantity" | "price">) {
  return `${t.portfolioId}|${t.symbol}|${t.type}|${t.date}|${t.quantity}|${t.price}`;
}

/** Bulk-adds transactions (e.g. from a broker CSV import) into one
 * portfolio, skipping any that already exist there by portfolio+symbol+
 * type+date+quantity+price, so re-importing the same statement is a no-op.
 * Returns how many were actually added. */
export function importTransactions(
  portfolioId: string,
  txs: Array<Omit<Transaction, "id" | "portfolioId">>
): number {
  const existingKeys = new Set(
    state.transactions.filter((t) => t.portfolioId === portfolioId).map(transactionKey)
  );
  const toAdd = txs.filter((t) => !existingKeys.has(transactionKey({ ...t, portfolioId })));
  if (toAdd.length === 0) return 0;

  const withIds = toAdd.map((t, i) => ({
    ...t,
    portfolioId,
    id: `tx-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
  }));
  commit({ ...state, transactions: [...state.transactions, ...withIds] });
  return withIds.length;
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
  quotes: Record<
    string,
    {
      price: number;
      previousClose?: number;
      currency?: string;
      fiftyTwoWeekLow?: number;
      fiftyTwoWeekHigh?: number;
    }
  >
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
      fiftyTwoWeekLow: q.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    };
  }
  commit({ ...state, prices: nextPrices });
}

/** Merges freshly fetched dividend history into the cache, keyed by symbol.
 * Symbols not present in `history` keep whatever was cached before. */
export function setDividendHistory(history: Record<string, DividendEvent[]>) {
  commit({
    ...state,
    dividendHistory: { ...state.dividendHistory, ...history },
  });
}

/** Merges freshly fetched sector data into the cache, keyed by symbol.
 * Symbols not present in `sectors` keep whatever was cached before. */
export function setSectors(sectors: Record<string, string>) {
  commit({
    ...state,
    sectors: { ...state.sectors, ...sectors },
  });
}

/** Patches a symbol's stop-loss/take-profit exit plan, dropping the entry
 * entirely once both fields are cleared so an unused symbol doesn't linger
 * in storage forever. */
export function setPositionTarget(symbol: string, patch: Partial<PositionTarget>) {
  const next = { ...state.positionTargets[symbol], ...patch };
  const positionTargets = { ...state.positionTargets };
  if (next.stopLoss == null && next.takeProfit == null) {
    delete positionTargets[symbol];
  } else {
    positionTargets[symbol] = next;
  }
  commit({ ...state, positionTargets });
}

export function addWatchlistItem(item: WatchlistItem) {
  if (state.watchlist.some((w) => w.symbol === item.symbol)) return;
  commit({ ...state, watchlist: [...state.watchlist, item] });
}

export function removeWatchlistItem(symbol: string) {
  commit({ ...state, watchlist: state.watchlist.filter((w) => w.symbol !== symbol) });
}

/** Patches a watchlist item's tags/target-price fields in place (e.g. from
 * an inline edit in the Watchlist table). No-op if the symbol isn't
 * watched. */
export function updateWatchlistItem(
  symbol: string,
  patch: Partial<Pick<WatchlistItem, "tags" | "targetAbove" | "targetBelow">>
) {
  commit({
    ...state,
    watchlist: state.watchlist.map((w) => (w.symbol === symbol ? { ...w, ...patch } : w)),
  });
}

export function setCurrency(currency: string) {
  commit({ ...state, currency });
}

export function addPortfolio(name: string, currency?: string): string {
  const id = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  commit({ ...state, portfolios: [...state.portfolios, { id, name, currency }] });
  return id;
}

export function renamePortfolio(id: string, name: string) {
  commit({
    ...state,
    portfolios: state.portfolios.map((p) => (p.id === id ? { ...p, name } : p)),
  });
}

export function setPortfolioCurrency(id: string, currency: string) {
  commit({
    ...state,
    portfolios: state.portfolios.map((p) => (p.id === id ? { ...p, currency } : p)),
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
    dividendHistory: {},
    sectors: {},
    positionTargets: {},
  });
}
