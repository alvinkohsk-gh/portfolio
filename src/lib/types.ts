export type TransactionType = "BUY" | "SELL" | "DIVIDEND";

export interface Portfolio {
  id: string;
  name: string;
  /** Display currency for this portfolio, overriding the global default
   * (PortfolioState.currency) when set. Like the global setting, this only
   * relabels amounts - it does not convert values between currencies. */
  currency?: string;
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
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
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
  /** Fetched sector cache per symbol (e.g. "Technology"), used to group the
   * allocation chart by sector instead of by individual holding. */
  sectors: Record<string, string>;
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
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  /** Where currentPrice sits between fiftyTwoWeekLow and fiftyTwoWeekHigh,
   * as a 0-100 percentage. Undefined until a live quote has supplied both
   * bounds; clamped in case a manual price override falls outside them. */
  fiftyTwoWeekPct?: number;
  marketValue: number;
  gain: number;
  gainPct: number;
  dayChange: number;
  dayChangePct: number;
  weight: number;
  realizedGain: number;
  /** Portion of `realizedGain` locked in by a closing trade (a sell against
   * a long, or a buy covering a short) dated today. */
  realizedGainToday: number;
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
  /** Currency the live quote itself was priced in (e.g. "USD"), as reported
   * by the price provider - independent of the portfolio's display
   * currency used to format this holding's numbers. */
  priceCurrency?: string;
  /** True when priceCurrency is known and doesn't match what the symbol's
   * suffix implies (e.g. a ".SI" counter priced in USD) - a strong signal
   * that a bare ticker resolved to the wrong company on the wrong
   * exchange, silently, and every derived number here is meaningless. */
  priceCurrencyMismatch?: boolean;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPct: number;
  dayChange: number;
  dayChangePct: number;
  totalRealizedGain: number;
  /** Sum of realizedGainToday across all holdings - gains/losses locked in
   * by trades closed today, as opposed to `dayChange` which is the
   * unrealized change in still-open positions. */
  totalRealizedGainToday: number;
  totalDividends: number;
  holdingsCount: number;
}
