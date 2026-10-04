import { Announcement } from "./newsSources";
import { getSupabaseAdmin } from "./supabaseAdmin";

/** Built-in fallback for the Watchlist Wire. The Wire is normally written by
 * an AI news scan that runs outside this codebase; when that scan stops
 * (its last run is older than STALE_AFTER_MS), the digest cron fills in
 * with this keyword-based version, built from the same feeds the digest
 * already fetches. No summaries are written - a stock is flagged when one
 * of its recent headlines matches a rule below. */

const STALE_AFTER_MS = 18 * 60 * 60 * 1000;
const RECENT_DAYS = 7;
const MAX_HEADLINES = 3;

const FLAG_RULES: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "earnings",
    pattern: /\b(earnings|results|(first|second|third|fourth|q[1-4]) quarter|quarterly|full[- ]year|eps|guidance|outlook|profit warning|forecast)\b/i,
  },
  { label: "deal", pattern: /\b(acquir\w*|acquisition|merger|takeover|buyout|tender offer|definitive agreement)\b/i },
  {
    label: "capital",
    pattern: /\b(offering|placement|rights issue|convertible|dilut\w*|buyback|repurchase|dividend|stock split|share consolidation|reverse split)\b/i,
  },
  { label: "analyst", pattern: /\b(upgrade[sd]?|downgrade[sd]?|price target|initiates coverage)\b/i },
  {
    label: "regulatory",
    pattern: /\b(lawsuit|class action|investigation|probe|subpoena|fda|approval|recall|delist\w*|trading halt|suspension)\b/i,
  },
  { label: "leadership", pattern: /\b(ceo|cfo|chairman|resign\w*|steps down|appoint\w*)\b/i },
  { label: "big move", pattern: /\b(surg\w*|soar\w*|plung\w*|tumbl\w*|skyrocket\w*|crash\w*|slump\w*)\b/i },
];

export interface WireHeadline {
  title: string;
  source?: string;
  url?: string;
  summary?: string;
  publishedAt?: string;
}

export interface WireRow {
  symbol: string;
  name: string | null;
  market: string;
  status: string;
  flagged: boolean;
  headlines: WireHeadline[];
  note: string;
}

/** Labels of the rules a headline matches. SEC 8-K/6-K filings are always
 * material events, so they count even when the title says nothing. */
export function flagReasons(item: Pick<Announcement, "title" | "summary" | "source">): string[] {
  const reasons = FLAG_RULES.filter((r) => r.pattern.test(item.title)).map((r) => r.label);
  if (item.source === "SEC EDGAR" && /Form (8-K|6-K)/.test(item.title)) reasons.push("SEC filing");
  if (item.source === "Corporate Action") reasons.push("corporate action");
  return [...new Set(reasons)];
}

function isRecent(date: string, now: Date): boolean {
  if (!date) return true; // undated items are kept; the feeds only return recent ones
  const ms = Date.parse(date);
  if (Number.isNaN(ms)) return true;
  return now.getTime() - ms <= RECENT_DAYS * 24 * 60 * 60 * 1000;
}

export function buildWireRow(
  symbol: string,
  name: string | undefined,
  items: Announcement[] | undefined,
  failed: boolean,
  now: Date
): WireRow {
  const market = symbol.toUpperCase().endsWith(".SI") ? "SGX" : "US";
  const seen = new Set<string>();
  const recent = (items ?? [])
    .filter((a) => isRecent(a.date, now))
    .filter((a) => {
      const key = a.link || a.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((a) => ({ item: a, reasons: flagReasons(a) }))
    // Flagged first, then newest first (undated last).
    .sort((x, y) => {
      const flagDiff = Number(y.reasons.length > 0) - Number(x.reasons.length > 0);
      if (flagDiff !== 0) return flagDiff;
      return (y.item.date || "").localeCompare(x.item.date || "");
    })
    .slice(0, MAX_HEADLINES);

  const reasons = [...new Set(recent.flatMap((r) => r.reasons))];
  const note = failed
    ? "Couldn't reach the news sources for this stock on the last scan."
    : recent.length === 0
      ? `No news in the last ${RECENT_DAYS} days.`
      : reasons.length > 0
        ? `Flagged by keyword: ${reasons.join(", ")}.`
        : "Recent news, nothing matched the flag rules.";

  return {
    symbol,
    name: name || null,
    market,
    status: failed ? "error" : "ok",
    flagged: reasons.length > 0,
    headlines: recent.map(({ item }) => ({
      title: item.title,
      source: item.source,
      url: item.link,
      summary: item.summary,
      publishedAt: item.date || undefined,
    })),
    note,
  };
}

/** Postgres jsonb reorders object keys, so compare field by field. */
function headlineKey(headlines: unknown): string {
  if (!Array.isArray(headlines)) return "";
  return JSON.stringify(
    (headlines as WireHeadline[]).map((h) => [h.title, h.url ?? null, h.source ?? null, h.summary ?? null, h.publishedAt ?? null])
  );
}

export interface WireScanResult {
  ran: boolean;
  reason?: string;
  changed?: number;
}

/** Writes the keyword Wire for `symbols` if the last Wire run is stale.
 * Only rows whose content changed are rewritten, so the Wire page's "new"
 * badges (driven by updated_at) still mean something changed. */
export async function runWireScanIfStale(
  symbols: Array<{ symbol: string; name?: string }>,
  announcements: Record<string, Announcement[]>,
  failedSymbols: string[],
  now: Date
): Promise<WireScanResult> {
  const admin = getSupabaseAdmin();
  const { data: lastRun, error: runError } = await admin
    .from("watchlist_news_runs")
    .select("ran_at")
    .eq("id", "latest")
    .maybeSingle();
  if (runError) throw runError;
  if (lastRun?.ran_at && now.getTime() - Date.parse(lastRun.ran_at as string) < STALE_AFTER_MS) {
    return { ran: false, reason: "AI scan is current" };
  }
  if (symbols.length === 0) return { ran: false, reason: "no watchlist symbols" };

  const { data: existing, error: existingError } = await admin
    .from("watchlist_news")
    .select("symbol, flagged, headlines, note, status");
  if (existingError) throw existingError;
  const bySymbol = new Map((existing ?? []).map((r) => [r.symbol as string, r]));

  const failed = new Set(failedSymbols);
  const changed = symbols
    .map(({ symbol, name }) => buildWireRow(symbol, name, announcements[symbol], failed.has(symbol), now))
    .filter((row) => {
      const prev = bySymbol.get(row.symbol);
      return (
        !prev ||
        prev.flagged !== row.flagged ||
        prev.note !== row.note ||
        prev.status !== row.status ||
        headlineKey(prev.headlines) !== headlineKey(row.headlines)
      );
    })
    .map((row) => ({ ...row, updated_at: now.toISOString() }));

  if (changed.length > 0) {
    const { error } = await admin.from("watchlist_news").upsert(changed, { onConflict: "symbol" });
    if (error) throw error;
  }
  const { error: writeRunError } = await admin
    .from("watchlist_news_runs")
    .upsert({ id: "latest", ran_at: now.toISOString(), count: symbols.length }, { onConflict: "id" });
  if (writeRunError) throw writeRunError;

  return { ran: true, changed: changed.length };
}
