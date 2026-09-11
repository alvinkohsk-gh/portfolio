import { DividendEvent } from "./types";

export async function fetchDividendHistory(
  symbols: string[]
): Promise<{ dividends: Record<string, DividendEvent[]>; errors: string[] }> {
  if (symbols.length === 0) return { dividends: {}, errors: [] };
  const res = await fetch(`/api/dividends?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) {
    return { dividends: {}, errors: symbols };
  }
  return res.json();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / MS_PER_DAY);
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ExpectedDividend {
  date: string;
  amountPerShare: number;
}

/** Estimates the next dividend payment date and per-share amount from past
 * payment history, using the median gap between the last few payments as
 * the expected cadence (quarterly, semi-annual, etc.) - not a real forecast,
 * just a projection of the company's own historical rhythm. Needs at least
 * two past payments to have a cadence to project from. If that projection
 * already lies in the past (a stale fetch, or a payment schedule that's
 * shifted), it's advanced by the same cadence until it's upcoming, capped at
 * a few hops so a broken cadence doesn't run away. */
export function estimateNextDividend(events: DividendEvent[]): ExpectedDividend | null {
  if (events.length < 2) return null;
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-5);
  const gaps = recent.slice(1).map((e, i) => daysBetween(recent[i].date, e.date));
  const positiveGaps = gaps.filter((g) => g > 0).sort((a, b) => a - b);
  if (positiveGaps.length === 0) return null;
  const medianGap = positiveGaps[Math.floor(positiveGaps.length / 2)];

  const last = sorted[sorted.length - 1];
  const today = new Date().toISOString().slice(0, 10);
  let nextDate = addDays(last.date, medianGap);
  for (let hops = 0; nextDate < today && hops < 4; hops++) {
    nextDate = addDays(nextDate, medianGap);
  }

  return { date: nextDate, amountPerShare: last.amount };
}
