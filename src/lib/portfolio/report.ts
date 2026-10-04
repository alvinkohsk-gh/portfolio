import { PortfolioState, Transaction } from "../types";
import { computeRealizedEvents, computeRealizedStats, RealizedEvent, RealizedStats } from "./realized";

export type ReportPeriod = "day" | "week" | "month";

export interface DateRange {
  start: string;
  end: string;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Transaction dates are plain yyyy-mm-dd strings with no timezone, so all
// date math here runs in UTC to keep a "day" from shifting across midnight.
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayIso(): string {
  const now = new Date();
  return toIso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function periodRange(period: ReportPeriod, anchor: string): DateRange {
  const d = parseIso(anchor);
  if (period === "day") return { start: anchor, end: anchor };
  if (period === "week") {
    // Weeks run Monday to Sunday.
    const offset = (d.getUTCDay() + 6) % 7;
    const start = new Date(d);
    start.setUTCDate(d.getUTCDate() - offset);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { start: toIso(start), end: toIso(end) };
  }
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { start: toIso(start), end: toIso(end) };
}

export function shiftAnchor(period: ReportPeriod, anchor: string, delta: number): string {
  const d = parseIso(anchor);
  if (period === "day") d.setUTCDate(d.getUTCDate() + delta);
  else if (period === "week") d.setUTCDate(d.getUTCDate() + delta * 7);
  // Snap to the 1st so stepping from e.g. 31 Jan doesn't skip February.
  else return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1)));
  return toIso(d);
}

export function periodLabel(period: ReportPeriod, anchor: string): string {
  const { start, end } = periodRange(period, anchor);
  const s = parseIso(start);
  if (period === "day") {
    return `${WEEKDAYS[s.getUTCDay()]}, ${s.getUTCDate()} ${MONTHS_SHORT[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
  }
  if (period === "month") return `${MONTHS_LONG[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
  const e = parseIso(end);
  const startPart =
    s.getUTCFullYear() === e.getUTCFullYear()
      ? `${s.getUTCDate()} ${MONTHS_SHORT[s.getUTCMonth()]}`
      : `${s.getUTCDate()} ${MONTHS_SHORT[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
  return `${startPart} – ${e.getUTCDate()} ${MONTHS_SHORT[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
}

/** Compact label for a period in the trend chart's x-axis. */
export function periodShortLabel(period: ReportPeriod, anchor: string): string {
  const s = parseIso(periodRange(period, anchor).start);
  if (period === "month") return `${MONTHS_SHORT[s.getUTCMonth()]} ${String(s.getUTCFullYear()).slice(2)}`;
  return `${s.getUTCDate()} ${MONTHS_SHORT[s.getUTCMonth()]}`;
}

const inRange = (date: string, range: DateRange) => date >= range.start && date <= range.end;

export interface SymbolBreakdown {
  symbol: string;
  name?: string;
  bought: number;
  sold: number;
  realized: number;
  dividends: number;
  transactions: number;
}

export interface PeriodReport {
  range: DateRange;
  transactions: Transaction[];
  realizedEvents: RealizedEvent[];
  realizedGain: number;
  stats: RealizedStats;
  dividends: number;
  /** Gross cost of buys in the period, fees included. */
  bought: number;
  /** Net proceeds of sells in the period, after fees. */
  sold: number;
  fees: number;
  buyCount: number;
  sellCount: number;
  dividendCount: number;
  bySymbol: SymbolBreakdown[];
  /** Realized gain per closing transaction, keyed by transaction id. */
  realizedByTxId: Record<string, number>;
}

function buildReport(
  transactions: Transaction[],
  allEvents: RealizedEvent[],
  range: DateRange
): PeriodReport {
  const txs = transactions
    .filter((t) => inRange(t.date, range))
    .sort((a, b) => b.date.localeCompare(a.date));
  const events = allEvents.filter((e) => inRange(e.date, range));

  const bySymbol = new Map<string, SymbolBreakdown>();
  const row = (t: { symbol: string; name?: string }) => {
    const existing = bySymbol.get(t.symbol);
    if (existing) {
      if (t.name && !existing.name) existing.name = t.name;
      return existing;
    }
    const created: SymbolBreakdown = {
      symbol: t.symbol,
      name: t.name,
      bought: 0,
      sold: 0,
      realized: 0,
      dividends: 0,
      transactions: 0,
    };
    bySymbol.set(t.symbol, created);
    return created;
  };

  let bought = 0;
  let sold = 0;
  let fees = 0;
  let dividends = 0;
  let buyCount = 0;
  let sellCount = 0;
  let dividendCount = 0;

  for (const t of txs) {
    const r = row(t);
    r.transactions += 1;
    const txFees = t.fees ?? 0;
    if (t.type === "BUY") {
      const cost = t.quantity * t.price + txFees;
      bought += cost;
      fees += txFees;
      buyCount += 1;
      r.bought += cost;
    } else if (t.type === "SELL") {
      const proceeds = t.quantity * t.price - txFees;
      sold += proceeds;
      fees += txFees;
      sellCount += 1;
      r.sold += proceeds;
    } else {
      dividends += t.price;
      dividendCount += 1;
      r.dividends += t.price;
    }
  }

  const realizedByTxId: Record<string, number> = {};
  for (const e of events) {
    row(e).realized += e.gain;
    const txId = e.id.replace(/-(sell|cover)$/, "");
    realizedByTxId[txId] = (realizedByTxId[txId] ?? 0) + e.gain;
  }

  return {
    range,
    transactions: txs,
    realizedEvents: events,
    realizedGain: events.reduce((sum, e) => sum + e.gain, 0),
    stats: computeRealizedStats(events),
    dividends,
    bought,
    sold,
    fees,
    buyCount,
    sellCount,
    dividendCount,
    bySymbol: [...bySymbol.values()].sort(
      (a, b) =>
        Math.abs(b.realized + b.dividends) - Math.abs(a.realized + a.dividends) ||
        b.bought + b.sold - (a.bought + a.sold)
    ),
    realizedByTxId,
  };
}

/** Summary of everything that happened in one date range. `state` should
 * already be scoped to the active portfolio. Realized gains are computed
 * over the full history first (so cost basis from earlier buys is right),
 * then filtered to closes that fall inside the range. */
export function computePeriodReport(state: PortfolioState, range: DateRange): PeriodReport {
  return buildReport(state.transactions, computeRealizedEvents(state), range);
}

export interface PeriodTrendPoint {
  anchor: string;
  label: string;
  realized: number;
  dividends: number;
  net: number;
}

/** Realized gain + dividends for the `count` periods ending at `anchor`,
 * oldest first. */
export function computePeriodTrend(
  state: PortfolioState,
  period: ReportPeriod,
  anchor: string,
  count = 12
): PeriodTrendPoint[] {
  const events = computeRealizedEvents(state);
  const points: PeriodTrendPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const a = shiftAnchor(period, anchor, -i);
    const range = periodRange(period, a);
    const realized = events.filter((e) => inRange(e.date, range)).reduce((s, e) => s + e.gain, 0);
    const dividends = state.transactions
      .filter((t) => t.type === "DIVIDEND" && inRange(t.date, range))
      .reduce((s, t) => s + t.price, 0);
    points.push({
      anchor: range.start,
      label: periodShortLabel(period, a),
      realized,
      dividends,
      net: realized + dividends,
    });
  }
  return points;
}
