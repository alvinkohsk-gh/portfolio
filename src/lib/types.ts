export type TransactionType = "BUY" | "SELL" | "DIVIDEND";

export interface Transaction {
  id: string;
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

export interface PortfolioState {
  transactions: Transaction[];
  prices: Record<string, PriceInfo>;
  watchlist: WatchlistItem[];
  currency: string;
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
