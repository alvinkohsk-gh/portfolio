import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

export interface Announcement {
  date: string; // ISO date, yyyy-mm-dd, when known - otherwise ""
  title: string;
  source: "Nasdaq" | "SGinvestors" | "Corporate Action";
  link?: string;
}

const SGX_LATEST_URL = "https://sginvestors.io/news/company-announcement/latest/";
const REQUEST_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" };

/** Nasdaq's own site is a React app backed by this public, no-key JSON API
 * (the same one nasdaq.com's press-release widget calls) - unofficial and
 * undocumented like the Yahoo Finance endpoints this app already relies on,
 * so treated the same way: best-effort, and any shape it doesn't recognize
 * is just skipped rather than thrown. US-listed symbols only. */
async function fetchNasdaqPressReleases(symbol: string): Promise<Announcement[]> {
  const url = `https://api.nasdaq.com/api/news/topic/press_release?q=${encodeURIComponent(
    symbol
  )}|stocks&limit=10&offset=0`;

  const res = await fetch(url, {
    headers: {
      ...REQUEST_HEADERS,
      accept: "application/json",
      origin: "https://www.nasdaq.com",
      referer: "https://www.nasdaq.com/",
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) return [];

  const data = await res.json();
  const rows: unknown[] = data?.data?.rows ?? data?.data?.headlines ?? [];

  return rows
    .map((raw): Announcement | null => {
      const row = raw as Record<string, unknown>;
      const title = row.title;
      if (typeof title !== "string" || title.length === 0) return null;
      const relativeUrl = typeof row.url === "string" ? row.url : undefined;
      const created = typeof row.created === "string" ? row.created : undefined;
      const parsedDate = created ? new Date(created) : null;
      return {
        date:
          parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toISOString().slice(0, 10)
            : "",
        title,
        source: "Nasdaq",
        link: relativeUrl
          ? relativeUrl.startsWith("http")
            ? relativeUrl
            : `https://www.nasdaq.com${relativeUrl}`
          : undefined,
      };
    })
    .filter((a): a is Announcement => a !== null);
}

/** Yahoo Finance's chart endpoint (same unofficial family used elsewhere in
 * this app) carries stock-split events alongside price history - a genuine,
 * verifiable corporate action rather than a news headline. */
async function fetchSplits(symbol: string): Promise<Announcement[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=10y&events=split`;

  const res = await fetch(url, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) return [];

  const data = await res.json();
  const splits = data?.chart?.result?.[0]?.events?.splits;
  if (!splits || typeof splits !== "object") return [];

  return Object.values(splits as Record<string, { date?: number; splitRatio?: string }>)
    .filter((s): s is { date: number; splitRatio: string } => typeof s?.date === "number")
    .map((s) => ({
      date: new Date(s.date * 1000).toISOString().slice(0, 10),
      title: s.splitRatio ? `Stock split ${s.splitRatio}` : "Stock split",
      source: "Corporate Action" as const,
    }));
}

/** sginvestors.io publishes a single rolling feed of the latest SGX company
 * announcements (not one page per counter), so this fetches that one page
 * and keeps only the entries whose text mentions one of the requested
 * names/symbols. There's no documented structure to this page - it's
 * scraped generically by pulling every link with substantial visible text
 * rather than depending on specific CSS classes, which is more likely to
 * survive a markup change than a brittle selector, at the cost of picking
 * up the occasional unrelated link. Best-effort: any parse failure just
 * yields no SGX announcements rather than breaking the whole response. */
async function fetchSgxAnnouncements(
  matchTerms: { symbol: string; name?: string }[]
): Promise<Record<string, Announcement[]>> {
  const result: Record<string, Announcement[]> = {};

  const res = await fetch(SGX_LATEST_URL, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) return result;

  const html = await res.text();
  const $ = cheerio.load(html);
  const dateRegex = /\b(\d{1,2}\s+\w{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2})\b/;

  $("a").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length < 12) return;
    const href = $(el).attr("href");

    for (const { symbol, name } of matchTerms) {
      const bareSymbol = symbol.replace(/\.SI$/i, "");
      const haystack = text.toLowerCase();
      const matches =
        haystack.includes(bareSymbol.toLowerCase()) ||
        (name != null && name.length > 2 && haystack.includes(name.toLowerCase()));
      if (!matches) continue;

      // Look at the surrounding block for a nearby date, since the link
      // text itself is usually just the headline.
      const context = $(el).closest("li, tr, div").text();
      const dateMatch = context.match(dateRegex);
      const list = result[symbol] ?? [];
      list.push({
        date: dateMatch ? dateMatch[1] : "",
        title: text,
        source: "SGinvestors",
        link: href
          ? href.startsWith("http")
            ? href
            : `https://sginvestors.io${href}`
          : undefined,
      });
      result[symbol] = list;
      break;
    }
  });

  return result;
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const namesParam = req.nextUrl.searchParams.get("names") ?? "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim()).filter(Boolean))];
  const names = namesParam.split(",").map((n) => decodeURIComponent(n.trim()));

  if (symbols.length === 0) {
    return NextResponse.json({ announcements: {}, errors: [] });
  }

  const announcements: Record<string, Announcement[]> = {};
  const errors: string[] = [];

  const sgxSymbols = symbols.filter((s) => s.toUpperCase().endsWith(".SI"));
  const matchTerms = symbols.map((symbol, i) => ({ symbol, name: names[i] || undefined }));

  await Promise.all([
    ...symbols.map(async (symbol) => {
      try {
        const items: Announcement[] = [];
        if (!symbol.toUpperCase().endsWith(".SI")) {
          items.push(...(await fetchNasdaqPressReleases(symbol)));
        }
        items.push(...(await fetchSplits(symbol)));
        if (items.length > 0) {
          announcements[symbol] = [...(announcements[symbol] ?? []), ...items];
        }
      } catch {
        errors.push(symbol);
      }
    }),
    (async () => {
      if (sgxSymbols.length === 0) return;
      try {
        const sgxResults = await fetchSgxAnnouncements(matchTerms);
        for (const [symbol, items] of Object.entries(sgxResults)) {
          announcements[symbol] = [...(announcements[symbol] ?? []), ...items];
        }
      } catch {
        // sginvestors.io unreachable or its markup changed - SGX
        // announcements are simply omitted, Nasdaq/splits still return.
      }
    })(),
  ]);

  return NextResponse.json({ announcements, errors });
}
