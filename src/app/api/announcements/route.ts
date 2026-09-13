import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

export interface Announcement {
  date: string; // ISO date, yyyy-mm-dd, when known - otherwise ""
  title: string;
  source:
    | "SEC EDGAR"
    | "Nasdaq"
    | "SGinvestors"
    | "Corporate Action"
    | "Yahoo Finance"
    | "SGX"
    | "Google News";
  link?: string;
  /** A brief, human-readable explanation of what this announcement is
   * about - the source's own snippet/excerpt when it provides one, or
   * otherwise a short generic description of what that source/form type
   * means, so a bare headline isn't the only context shown. */
  summary?: string;
}

const FORM_DESCRIPTIONS: Record<string, string> = {
  "8-K": "Official SEC filing disclosing a material event (e.g. a major transaction, leadership change, or other significant development).",
  "8-K/A": "Amended SEC filing correcting or adding to a previously disclosed material event.",
  "6-K": "Official SEC filing by a foreign private issuer disclosing material information required in its home market.",
  "6-K/A": "Amended version of a foreign private issuer's material event disclosure.",
};

/** Per-source outcome for one fetch attempt, surfaced to the client so a
 * silently-empty result (bot-blocked, markup changed, JS-rendered page,
 * etc.) can actually be diagnosed instead of just looking like "no news
 * today". */
export interface SourceDebug {
  attempted: boolean;
  httpStatus?: number;
  itemCount?: number;
  error?: string;
}

const SGX_LATEST_URL = "https://sginvestors.io/news/company-announcement/latest/";
const REQUEST_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" };

/** Nasdaq's own site is a React app backed by this public, no-key JSON API
 * (the same one nasdaq.com's press-release widget calls) - unofficial and
 * undocumented like the Yahoo Finance endpoints this app already relies on,
 * so treated the same way: best-effort, and any shape it doesn't recognize
 * is just skipped rather than thrown. US-listed symbols only. */
async function fetchNasdaqPressReleases(
  symbol: string
): Promise<{ items: Announcement[]; debug: SourceDebug }> {
  const url = `https://api.nasdaq.com/api/news/topic/press_release?q=${encodeURIComponent(
    symbol
  )}|stocks&limit=10&offset=0`;

  try {
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
    if (!res.ok) {
      return { items: [], debug: { attempted: true, httpStatus: res.status } };
    }

    const data = await res.json();
    const rows: unknown[] = data?.data?.rows ?? data?.data?.headlines ?? [];

    const items = rows
      .map((raw): Announcement | null => {
        const row = raw as Record<string, unknown>;
        const title = row.title;
        if (typeof title !== "string" || title.length === 0) return null;
        const relativeUrl = typeof row.url === "string" ? row.url : undefined;
        const created = typeof row.created === "string" ? row.created : undefined;
        const parsedDate = created ? new Date(created) : null;
        const excerpt = typeof row.excerpt === "string" ? row.excerpt : undefined;
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
          summary:
            excerpt && excerpt.length > 0
              ? excerpt
              : "Press release covering company news - not an official regulatory filing.",
        };
      })
      .filter((a): a is Announcement => a !== null);

    return { items, debug: { attempted: true, httpStatus: res.status, itemCount: items.length } };
  } catch (err) {
    return {
      items: [],
      debug: { attempted: true, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

/** The SEC's fair-access policy for www.sec.gov / data.sec.gov asks
 * requests to identify a real application + contact in the User-Agent
 * rather than a generic browser string, so these two hosts get their own
 * header instead of the shared REQUEST_HEADERS used for everything else. */
const SEC_HEADERS = {
  "User-Agent": "PortfolioTracker/1.0 (contact: portfoliotracker.app@example.com)",
  Accept: "application/json",
};

let cikMapPromise: Promise<Record<string, string>> | null = null;

/** SEC EDGAR indexes companies by CIK (Central Index Key), not ticker, so
 * this fetches the SEC's own official ticker -> CIK mapping once per warm
 * server instance and reuses it across requests/symbols rather than
 * re-fetching a multi-megabyte file every time. */
function loadCikMap(): Promise<Record<string, string>> {
  if (!cikMapPromise) {
    cikMapPromise = (async () => {
      const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
        headers: SEC_HEADERS,
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`company_tickers.json returned ${res.status}`);
      const data = await res.json();
      const map: Record<string, string> = {};
      for (const entry of Object.values(data) as Array<{ ticker?: string; cik_str?: number }>) {
        if (entry.ticker && entry.cik_str != null) {
          map[entry.ticker.toUpperCase()] = String(entry.cik_str).padStart(10, "0");
        }
      }
      return map;
    })().catch((err) => {
      // Let the next request retry instead of caching a failure forever.
      cikMapPromise = null;
      throw err;
    });
  }
  return cikMapPromise;
}

// Material-event forms - the actual regulatory definition of a "company
// announcement" for a US-listed issuer, as opposed to routine periodic
// reports (10-K/10-Q) or ownership filings.
const MATERIAL_EVENT_FORMS = new Set(["8-K", "8-K/A", "6-K", "6-K/A"]);

/** Official filings straight from the SEC's own EDGAR system - genuine
 * regulatory disclosures, unlike the unofficial press/news feeds elsewhere
 * in this file. US-listed symbols only (EDGAR doesn't cover SGX). */
async function fetchSecFilings(
  symbol: string
): Promise<{ items: Announcement[]; debug: SourceDebug }> {
  try {
    const cikMap = await loadCikMap();
    const cik = cikMap[symbol.toUpperCase()];
    if (!cik) {
      return {
        items: [],
        debug: { attempted: true, error: "symbol not found in SEC ticker map" },
      };
    }

    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: SEC_HEADERS,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { items: [], debug: { attempted: true, httpStatus: res.status } };
    }

    const data = await res.json();
    const recent = data?.filings?.recent;
    const forms: unknown[] = recent?.form ?? [];
    const dates: unknown[] = recent?.filingDate ?? [];
    const accessionNumbers: unknown[] = recent?.accessionNumber ?? [];
    const primaryDocs: unknown[] = recent?.primaryDocument ?? [];
    const cikNumeric = String(Number(cik));

    const items: Announcement[] = [];
    for (let i = 0; i < forms.length && items.length < 10; i++) {
      const form = forms[i];
      if (typeof form !== "string" || !MATERIAL_EVENT_FORMS.has(form)) continue;
      const date = typeof dates[i] === "string" ? (dates[i] as string) : "";
      const accession = typeof accessionNumbers[i] === "string" ? (accessionNumbers[i] as string) : "";
      const primaryDoc = typeof primaryDocs[i] === "string" ? (primaryDocs[i] as string) : "";
      const accessionNoDashes = accession.replace(/-/g, "");
      items.push({
        date,
        title: `SEC filing: Form ${form}`,
        source: "SEC EDGAR",
        link:
          accessionNoDashes && primaryDoc
            ? `https://www.sec.gov/Archives/edgar/data/${cikNumeric}/${accessionNoDashes}/${primaryDoc}`
            : undefined,
        summary: FORM_DESCRIPTIONS[form] ?? "Official SEC regulatory filing.",
      });
    }

    return { items, debug: { attempted: true, httpStatus: res.status, itemCount: items.length } };
  } catch (err) {
    return {
      items: [],
      debug: { attempted: true, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

/** Yahoo Finance's chart endpoint (same unofficial family used elsewhere in
 * this app) carries stock-split events alongside price history - a genuine,
 * verifiable corporate action rather than a news headline. */
async function fetchSplits(symbol: string): Promise<{ items: Announcement[]; debug: SourceDebug }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=10y&events=split`;

  try {
    const res = await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { items: [], debug: { attempted: true, httpStatus: res.status } };
    }

    const data = await res.json();
    const splits = data?.chart?.result?.[0]?.events?.splits;
    if (!splits || typeof splits !== "object") {
      return { items: [], debug: { attempted: true, httpStatus: res.status, itemCount: 0 } };
    }

    const items = Object.values(splits as Record<string, { date?: number; splitRatio?: string }>)
      .filter((s): s is { date: number; splitRatio: string } => typeof s?.date === "number")
      .map((s) => ({
        date: new Date(s.date * 1000).toISOString().slice(0, 10),
        title: s.splitRatio ? `Stock split ${s.splitRatio}` : "Stock split",
        source: "Corporate Action" as const,
        summary:
          "A change in the number of outstanding shares - existing shares are divided (or combined) without changing the total value held.",
      }));

    return { items, debug: { attempted: true, httpStatus: res.status, itemCount: items.length } };
  } catch (err) {
    return {
      items: [],
      debug: { attempted: true, error: err instanceof Error ? err.message : String(err) },
    };
  }
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
): Promise<{ result: Record<string, Announcement[]>; debug: SourceDebug }> {
  const result: Record<string, Announcement[]> = {};

  try {
    const res = await fetch(SGX_LATEST_URL, {
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { result, debug: { attempted: true, httpStatus: res.status } };
    }

    const html = await res.text();
    const totalLinks = (html.match(/<a\s/gi) ?? []).length;
    const $ = cheerio.load(html);
    const dateRegex = /\b(\d{1,2}\s+\w{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2})\b/;
    let matchedCount = 0;

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
          summary:
            "SGX company announcement surfaced via SGinvestors.io's news feed - not itself the official filing.",
        });
        result[symbol] = list;
        matchedCount++;
        break;
      }
    });

    return {
      result,
      debug: {
        attempted: true,
        httpStatus: res.status,
        itemCount: matchedCount,
        // Included so a zero-match result can be told apart from a page
        // that returned no <a> tags at all (e.g. a JS-rendered shell where
        // the real content never appears in the raw HTML).
        error: totalLinks === 0 ? "page had no <a> tags in raw HTML" : undefined,
      },
    };
  } catch (err) {
    return {
      result,
      debug: { attempted: true, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

/** Yahoo Finance's unofficial search endpoint returns a `news` array
 * alongside quote matches - the same news feed shown on a stock's Yahoo
 * Finance page. Queried by company name (falls back to bare symbol) since
 * the search endpoint matches free text rather than a specific ticker
 * field. SGX symbols only - other exchanges already have SEC/Nasdaq
 * coverage above. */
async function fetchYahooNews(
  symbol: string,
  name?: string
): Promise<{ items: Announcement[]; debug: SourceDebug }> {
  const query = name && name.length > 2 ? name : symbol.replace(/\.SI$/i, "");
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    query
  )}&newsCount=10&quotesCount=0`;

  try {
    const res = await fetch(url, {
      headers: { ...REQUEST_HEADERS, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { items: [], debug: { attempted: true, httpStatus: res.status } };
    }

    const data = await res.json();
    const news: unknown[] = data?.news ?? [];

    const items = news
      .map((raw): Announcement | null => {
        const row = raw as Record<string, unknown>;
        const title = row.title;
        if (typeof title !== "string" || title.length === 0) return null;
        const link = typeof row.link === "string" ? row.link : undefined;
        const pubTime = typeof row.providerPublishTime === "number" ? row.providerPublishTime : undefined;
        const publisher = typeof row.publisher === "string" ? row.publisher : undefined;
        return {
          date: pubTime ? new Date(pubTime * 1000).toISOString().slice(0, 10) : "",
          title,
          source: "Yahoo Finance",
          link,
          summary: `News article${publisher ? ` from ${publisher}` : ""} about the company, surfaced via Yahoo Finance - not an official filing.`,
        };
      })
      .filter((a): a is Announcement => a !== null);

    return { items, debug: { attempted: true, httpStatus: res.status, itemCount: items.length } };
  } catch (err) {
    return {
      items: [],
      debug: { attempted: true, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

/** SGX itself exposes a JSON API (api.sgx.com) behind its own website's
 * announcement search page, but its exact request/response shape isn't
 * publicly documented - this is a best-effort guess at the endpoint used
 * by sgx.com's "Company Announcements" search, and is expected to need
 * adjustment once actually verified against production. Kept fully
 * best-effort like everything else in this file: any shape mismatch or
 * failure just yields zero items rather than throwing. */
async function fetchSgxOfficialApi(
  symbol: string
): Promise<{ items: Announcement[]; debug: SourceDebug }> {
  const bareSymbol = symbol.replace(/\.SI$/i, "");
  const url = `https://api.sgx.com/announcements/v1.0/?issuer_code=${encodeURIComponent(
    bareSymbol
  )}&pagestart=0&pagesize=10`;

  try {
    const res = await fetch(url, {
      headers: { ...REQUEST_HEADERS, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { items: [], debug: { attempted: true, httpStatus: res.status } };
    }

    const data = await res.json();
    const rows: unknown[] = data?.data ?? data?.items ?? [];

    const items = rows
      .map((raw): Announcement | null => {
        const row = raw as Record<string, unknown>;
        const title = row.title ?? row.announcement_title ?? row.headline;
        if (typeof title !== "string" || title.length === 0) return null;
        const dateRaw = row.date ?? row.broadcast_date ?? row.submitted_date;
        const parsedDate = typeof dateRaw === "string" ? new Date(dateRaw) : null;
        const link = row.url ?? row.file_url ?? row.link;
        const description = row.summary ?? row.description ?? row.category;
        return {
          date:
            parsedDate && !Number.isNaN(parsedDate.getTime())
              ? parsedDate.toISOString().slice(0, 10)
              : "",
          title,
          source: "SGX",
          link: typeof link === "string" ? link : undefined,
          summary:
            typeof description === "string" && description.length > 0
              ? description
              : "SGX company announcement (unverified endpoint - shape not publicly documented).",
        };
      })
      .filter((a): a is Announcement => a !== null);

    return { items, debug: { attempted: true, httpStatus: res.status, itemCount: items.length } };
  } catch (err) {
    return {
      items: [],
      debug: { attempted: true, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

/** Google News RSS is a public, no-key search feed - queried by company
 * name (falls back to bare symbol) restricted to Singapore/English results
 * so a "DBS" style name doesn't pull in unrelated global noise. It's
 * general news coverage, not a regulatory or exchange source, so it's
 * clearly labelled "Google News" rather than implied to be official. */
async function fetchGoogleNewsRss(
  symbol: string,
  name?: string
): Promise<{ items: Announcement[]; debug: SourceDebug }> {
  const query = name && name.length > 2 ? name : symbol.replace(/\.SI$/i, "");
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    `${query} SGX`
  )}&hl=en-SG&gl=SG&ceid=SG:en`;

  try {
    const res = await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { items: [], debug: { attempted: true, httpStatus: res.status } };
    }

    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const items: Announcement[] = [];
    $("item").each((_, el) => {
      if (items.length >= 10) return;
      const title = $(el).find("title").first().text().trim();
      if (!title) return;
      const link = $(el).find("link").first().text().trim();
      const pubDate = $(el).find("pubDate").first().text().trim();
      const parsedDate = pubDate ? new Date(pubDate) : null;
      const rawDescription = $(el).find("description").first().text();
      // Google's description field is itself an HTML snippet (an <a> tag
      // wrapping the headline plus the source name), so strip tags down to
      // plain text rather than showing raw markup.
      const plainDescription = cheerio.load(rawDescription).text().replace(/\s+/g, " ").trim();
      items.push({
        date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : "",
        title,
        source: "Google News",
        link: link || undefined,
        summary:
          plainDescription.length > 0 && plainDescription !== title
            ? plainDescription
            : "News coverage about the company, surfaced via Google News - not an official filing.",
      });
    });

    return { items, debug: { attempted: true, httpStatus: res.status, itemCount: items.length } };
  } catch (err) {
    return {
      items: [],
      debug: { attempted: true, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const namesParam = req.nextUrl.searchParams.get("names") ?? "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim()).filter(Boolean))];
  const names = namesParam.split(",").map((n) => decodeURIComponent(n.trim()));

  if (symbols.length === 0) {
    return NextResponse.json({ announcements: {}, errors: [], debug: {} });
  }

  const announcements: Record<string, Announcement[]> = {};
  const errors: string[] = [];
  const debug: Record<
    string,
    {
      nasdaq?: SourceDebug;
      secEdgar?: SourceDebug;
      splits?: SourceDebug;
      yahooNews?: SourceDebug;
      sgxApi?: SourceDebug;
      googleNews?: SourceDebug;
    }
  > & { sgx?: SourceDebug } = {};

  const sgxSymbols = symbols.filter((s) => s.toUpperCase().endsWith(".SI"));
  const matchTerms = symbols.map((symbol, i) => ({ symbol, name: names[i] || undefined }));

  await Promise.all([
    ...symbols.map(async (symbol) => {
      try {
        const items: Announcement[] = [];
        const symbolDebug: {
          nasdaq?: SourceDebug;
          secEdgar?: SourceDebug;
          splits?: SourceDebug;
          yahooNews?: SourceDebug;
          sgxApi?: SourceDebug;
          googleNews?: SourceDebug;
        } = {};
        const name = matchTerms.find((m) => m.symbol === symbol)?.name;

        if (!symbol.toUpperCase().endsWith(".SI")) {
          const [
            { items: secItems, debug: secDebug },
            { items: nasdaqItems, debug: nasdaqDebug },
          ] = await Promise.all([fetchSecFilings(symbol), fetchNasdaqPressReleases(symbol)]);
          items.push(...secItems);
          symbolDebug.secEdgar = secDebug;
          items.push(...nasdaqItems);
          symbolDebug.nasdaq = nasdaqDebug;
        } else {
          const [
            { items: yahooItems, debug: yahooDebug },
            { items: sgxApiItems, debug: sgxApiDebug },
            { items: googleItems, debug: googleDebug },
          ] = await Promise.all([
            fetchYahooNews(symbol, name),
            fetchSgxOfficialApi(symbol),
            fetchGoogleNewsRss(symbol, name),
          ]);
          items.push(...yahooItems);
          symbolDebug.yahooNews = yahooDebug;
          items.push(...sgxApiItems);
          symbolDebug.sgxApi = sgxApiDebug;
          items.push(...googleItems);
          symbolDebug.googleNews = googleDebug;
        }
        const { items: splitItems, debug: splitsDebug } = await fetchSplits(symbol);
        items.push(...splitItems);
        symbolDebug.splits = splitsDebug;

        debug[symbol] = symbolDebug;
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
        const { result: sgxResults, debug: sgxDebug } = await fetchSgxAnnouncements(matchTerms);
        debug.sgx = sgxDebug;
        for (const [symbol, items] of Object.entries(sgxResults)) {
          announcements[symbol] = [...(announcements[symbol] ?? []), ...items];
        }
      } catch (err) {
        debug.sgx = { attempted: true, error: err instanceof Error ? err.message : String(err) };
      }
    })(),
  ]);

  return NextResponse.json({ announcements, errors, debug });
}
