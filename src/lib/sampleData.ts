import { PortfolioState } from "./types";

const SAMPLE_PRICE_TIMESTAMP = "2024-06-03T13:30:00.000Z";

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const sampleState: PortfolioState = {
  currency: "USD",
  transactions: [
    {
      id: "seed-1",
      symbol: "AAPL",
      name: "Apple Inc.",
      type: "BUY",
      date: daysAgo(400),
      quantity: 20,
      price: 165.3,
      fees: 1,
    },
    {
      id: "seed-2",
      symbol: "AAPL",
      name: "Apple Inc.",
      type: "BUY",
      date: daysAgo(180),
      quantity: 10,
      price: 190.5,
      fees: 1,
    },
    {
      id: "seed-3",
      symbol: "MSFT",
      name: "Microsoft Corporation",
      type: "BUY",
      date: daysAgo(300),
      quantity: 12,
      price: 330.1,
      fees: 1,
    },
    {
      id: "seed-4",
      symbol: "VOO",
      name: "Vanguard S&P 500 ETF",
      type: "BUY",
      date: daysAgo(500),
      quantity: 15,
      price: 380,
      fees: 0,
    },
    {
      id: "seed-5",
      symbol: "VOO",
      name: "Vanguard S&P 500 ETF",
      type: "BUY",
      date: daysAgo(60),
      quantity: 5,
      price: 470,
      fees: 0,
    },
    {
      id: "seed-6",
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      type: "BUY",
      date: daysAgo(250),
      quantity: 8,
      price: 450,
      fees: 1,
    },
    {
      id: "seed-7",
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      type: "SELL",
      date: daysAgo(30),
      quantity: 3,
      price: 900,
      fees: 1,
    },
    {
      id: "seed-8",
      symbol: "AAPL",
      name: "Apple Inc.",
      type: "DIVIDEND",
      date: daysAgo(90),
      quantity: 30,
      price: 7.2,
    },
    {
      id: "seed-9",
      symbol: "MSFT",
      name: "Microsoft Corporation",
      type: "DIVIDEND",
      date: daysAgo(45),
      quantity: 12,
      price: 8.4,
    },
  ],
  prices: {
    AAPL: {
      symbol: "AAPL",
      price: 227.5,
      previousClose: 225.1,
      currency: "USD",
      updatedAt: SAMPLE_PRICE_TIMESTAMP,
      source: "manual",
    },
    MSFT: {
      symbol: "MSFT",
      price: 415.2,
      previousClose: 418.0,
      currency: "USD",
      updatedAt: SAMPLE_PRICE_TIMESTAMP,
      source: "manual",
    },
    VOO: {
      symbol: "VOO",
      price: 512.8,
      previousClose: 510.4,
      currency: "USD",
      updatedAt: SAMPLE_PRICE_TIMESTAMP,
      source: "manual",
    },
    NVDA: {
      symbol: "NVDA",
      price: 118.6,
      previousClose: 120.1,
      currency: "USD",
      updatedAt: SAMPLE_PRICE_TIMESTAMP,
      source: "manual",
    },
  },
  watchlist: [
    { symbol: "GOOGL", name: "Alphabet Inc." },
    { symbol: "AMZN", name: "Amazon.com Inc." },
  ],
};
