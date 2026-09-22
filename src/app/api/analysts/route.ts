import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface AnalystInfo {
  /** Yahoo's own bucketed call, e.g. "strong_buy" | "buy" | "hold" | "sell"
   * | "strong_sell" | "none". */
  recommendationKey?: string;
  /** 1 (strong buy) - 5 (strong sell). */
  recommendationMean?: number;
  targetMeanPrice?: number;
  targetHighPrice?: number;
  targetLowPrice?: number;
  numberOfAnalysts?: number;
  /** The price Yahoo computed upside/downside against - from the same
   * response as the target prices, so the two stay consistent even if it
   * differs slightly from this app's own live quote. */
  currentPrice?: number;
}

interface YahooRawNumber {
  raw?: number;
}

function num(v: YahooRawNumber | undefined): number | undefined {
  return typeof v?.raw === "number" ? v.raw : undefined;
}

// Yahoo Finance's public, unofficial quoteSummary endpoint (financialData
// module) - same family as /api/earnings, with the same caveat: this
// endpoint has a history of occasionally requiring a crumb/cookie
// handshake that unauthenticated requests don't always get.
async function fetchAnalystInfo(symbol: string): Promise<AnalystInfo | null> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    symbol
  )}?modules=financialData`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = await res.json();
    const fd = data?.quoteSummary?.result?.[0]?.financialData;
    if (!fd) return null;

    const info: AnalystInfo = {
      recommendationKey: typeof fd.recommendationKey === "string" ? fd.recommendationKey : undefined,
      recommendationMean: num(fd.recommendationMean),
      targetMeanPrice: num(fd.targetMeanPrice),
      targetHighPrice: num(fd.targetHighPrice),
      targetLowPrice: num(fd.targetLowPrice),
      numberOfAnalysts: num(fd.numberOfAnalystOpinions),
      currentPrice: num(fd.currentPrice),
    };
    // Nothing usable came back - treat like a miss rather than an empty row.
    if (info.recommendationKey == null && info.targetMeanPrice == null) return null;
    return info;
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

  const data: Record<string, AnalystInfo> = {};
  const errors: string[] = [];

  await Promise.all(
    symbols.map(async (symbol) => {
      const info = await fetchAnalystInfo(symbol);
      if (info) {
        data[symbol] = info;
      } else {
        errors.push(symbol);
      }
    })
  );

  return NextResponse.json({ data, errors });
}
