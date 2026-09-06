export type TransactionType = "BUY" | "SELL" | "DIVIDEND";

export interface Portfolio {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  portfolioId: string;
  symbol: string;
  name?: string;
  type: TransactionType;
  date: string; // ISO date, yyyy-mm-dd
  /** Shares for BUY/SELL. For DIVIDEND this is informational only (shares held). */
  quantity: number;
  /** Price per share for BUY/SELL. For DIVIDEND this is the total cash amount received. */
  price: number;
  fees?: number;
  notes?: string;
}

export interface PriceInfo {
  symbol: string;
  price: number;
  previousClose?: number;
  currency?: string;
  updatedAt: string; // ISO timestamp
  source: "manual" | "live";
}

export interface WatchlistItem {
  symbol: string;
  name?: string;
}

/** One historical per-share cash dividend payment for a symbol, as fetched
 * from an external price/dividend provider. */
export interface DividendEvent {
  date: string; // ISO date, yyyy-mm-dd - the ex-dividend date
  amount: number; // cash amount per share
}

export type CorporateActionType = "SPLIT" | "MERGER";

/** A stock split, consolidation (reverse split), or merger/ticker change.
 * Applied non-destructively: original transactions are never rewritten -
 * this is just a rule for re-expressing a transaction dated before
 * `date` in today's share count/symbol terms at computation time. */
export interface CorporateAction {
  id: string;
  type: CorporateActionType;
  /** Effective date, yyyy-mm-dd. Transactions dated before this are
   * re-expressed in post-action terms; transactions on or after it are
   * assumed to already reflect the new share count/symbol. */
  date: string;
  /** Symbol this action applies to, as held before the action. */
  symbol: string;
  /** Resulting symbol. Equals `symbol` for a SPLIT; for a MERGER this is
   * the ticker shareholders end up holding. */
  newSymbol: string;
  /** New shares per old share - e.g. 2 for a 2-for-1 split, 0.1 for a
   * 1-for-10 consolidation, or a merger's stock-for-stock exchange ratio. */
  ratio: number;
  /** Optional cash paid per old share as part of a merger. */
  cashPerShare?: number;
  source: "manual" | "auto";
}

/** Sentinel activePortfolioId meaning "show every portfolio combined". */
export const ALL_PORTFOLIOS = "all";

export interface PortfolioState {
  transactions: Transaction[];
  prices: Record<string, PriceInfo>;
  watchlist: WatchlistItem[];
  currency: string;
  portfolios: Portfolio[];
  activePortfolioId: string;
  /** Fetched dividend-history cache per symbol, used to estimate lifetime
   * dividends for periods without a manually logged DIVIDEND transaction. */
  dividendHistory: Record<string, DividendEvent[]>;
  corporateActions: CorporateAction[];
}

export interface Holding {
  symbol: string;
  name?: string;
  quantity: number;
  avgCost: number;
  costBasis: number;
  currentPrice: number;
  priceUpdatedAt?: string;
  priceSource?: "manual" | "live";
  previousClose?: number;
  marketValue: number;
  gain: number;
  gainPct: number;
  dayChange: number;
  dayChangePct: number;
  weight: number;
  realizedGain: number;
  dividends: number;
  /** Portion of `dividends` estimated from fetched dividend history for
   * periods without a manually logged DIVIDEND transaction, rather than
   * entered by hand. Included in `dividends`, broken out here for display. */
  estimatedDividends: number;
  /** Capital gain plus dividends received on this holding. */
  totalReturn: number;
  totalReturnPct: number;
  /** Average cost per share minus dividends received per share held -
   * how much of the original cost basis dividends have paid back. */
  dividendAdjustedAvgCost: number;
  firstBuyDate?: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPct: number;
  dayChange: number;
  dayChangePct: number;
  totalRealizedGain: number;
  totalDividends: number;
  holdingsCount: number;
}
