import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface EarningsInfo {
  /** ISO yyyy-mm-dd. When Yahoo reports a date range instead of a single
   * day, this is the start. */
  date: string;
  /** End of the reported range, if different from `date`. */
  dateEnd?: string;
}

interface YahooCalendarDate {
  raw?: number; // unix seconds
  fmt?: string; // "yyyy-mm-dd"
}

function toIsoDate(d: YahooCalendarDate | undefined): string | undefined {
  if (!d) return undefined;
  if (d.fmt) return d.fmt;
  if (typeof d.raw === "number") return new Date(d.raw * 1000).toISOString().slice(0, 10);
  return undefined;
}

// Yahoo Finance's public, unofficial quoteSummary endpoint - same
// no-key/unauthenticated family as /api/quote and /api/pressure, but this
// particular endpoint has a history of being locked down behind a
// crumb/cookie handshake for some request shapes. If it's unreachable from
// the deploy environment, this route simply omits that symbol.
async function fetchEarnings(symbol: string): Promise<EarningsInfo | null> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    symbol
  )}?modules=calendarEvents`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = await res.json();
    const dates: YahooCalendarDate[] =
      data?.quoteSummary?.result?.[0]?.calendarEvents?.earnings?.earningsDate ?? [];
    const date = toIsoDate(dates[0]);
    if (!date) return null;

    const dateEnd = dates.length > 1 ? toIsoDate(dates[1]) : undefined;
    return { date, dateEnd: dateEnd && dateEnd !== date ? dateEnd : undefined };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim()).filter(Boolean))];

  if (symbols.length === 0) {
    return NextResponse.json({ data: {}, errors: [] });
  }

  const data: Record<string, EarningsInfo> = {};
  const errors: string[] = [];

  await Promise.all(
    symbols.map(async (symbol) => {
      const info = await fetchEarnings(symbol);
      if (info) {
        data[symbol] = info;
      } else {
        errors.push(symbol);
      }
    })
  );

  return NextResponse.json({ data, errors });
}
