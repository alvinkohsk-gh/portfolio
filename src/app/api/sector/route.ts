import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Uses Yahoo Finance's public quoteSummary endpoint (same unofficial family
// as /api/quote and /api/dividends) with the assetProfile module, which is
// the one that carries GICS-style sector classification. Best-effort: on
// failure this just omits the symbol and the client keeps whatever sector
// it already has cached (or falls back to "Other" in the UI).
async function fetchSector(symbol: string): Promise<string | null> {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    symbol
  )}?modules=assetProfile`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = await res.json();
  const sector = data?.quoteSummary?.result?.[0]?.assetProfile?.sector;
  return typeof sector === "string" && sector.length > 0 ? sector : null;
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim()).filter(Boolean))];

  if (symbols.length === 0) {
    return NextResponse.json({ sectors: {}, errors: [] });
  }

  const sectors: Record<string, string> = {};
  const errors: string[] = [];

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        let sector = await fetchSector(symbol);
        // Same bare-ticker -> SGX fallback as /api/quote and /api/dividends,
        // so SGX-listed counters resolve without the .SI suffix.
        if (!sector && !symbol.includes(".")) {
          sector = await fetchSector(`${symbol}.SI`);
        }
        if (sector) {
          sectors[symbol] = sector;
        } else {
          errors.push(symbol);
        }
      } catch {
        errors.push(symbol);
      }
    })
  );

  return NextResponse.json({ sectors, errors });
}
