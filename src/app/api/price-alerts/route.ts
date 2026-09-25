import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/server/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MOVE_THRESHOLD_PCT = 10;

interface WatchlistItem {
  symbol: string;
  name?: string;
}

interface Quote {
  price: number;
  previousClose: number;
}

/** Same public, unofficial Yahoo Finance chart endpoint /api/quote already
 * relies on - kept as a small standalone copy here rather than a shared
 * import, since this route only needs price + previousClose. */
async function fetchQuote(symbol: string): Promise<Quote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=1d`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const previousClose = meta?.chartPreviousClose ?? meta?.previousClose;
    if (typeof price !== "number" || typeof previousClose !== "number" || previousClose === 0) {
      return null;
    }
    return { price, previousClose };
  } catch {
    return null;
  }
}

/** This route is hit on a schedule by a GitHub Actions workflow (see
 * .github/workflows/price-alerts.yml), not Vercel Cron - the Hobby plan
 * caps Vercel Cron at once/day per job, too coarse to catch an intraday
 * +/-10% move. GitHub Actions' scheduler has no such limit, and this
 * route's own auth doesn't care who calls it as long as they have the
 * shared secret, so it works the same way Vercel's CRON_SECRET-gated
 * routes do. */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured." }, { status: 500 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, telegram_chat_id")
    .not("telegram_chat_id", "is", null);
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const targets = (profiles ?? []).filter(
    (p): p is { id: string; telegram_chat_id: string } => !!p.telegram_chat_id
  );
  if (targets.length === 0) {
    return NextResponse.json({ usersChecked: 0, alertsSent: 0 });
  }

  // One watchlist (with names) per user, and the union of every symbol
  // across all of them so each symbol is quoted once no matter how many
  // users are watching it.
  const userWatchlists = new Map<string, WatchlistItem[]>();
  for (const target of targets) {
    const { data: portfolioRow } = await supabaseAdmin
      .from("portfolio_data")
      .select("state")
      .eq("user_id", target.id)
      .maybeSingle();
    const watchlist: WatchlistItem[] = Array.isArray(
      (portfolioRow?.state as { watchlist?: unknown })?.watchlist
    )
      ? (portfolioRow!.state as { watchlist: WatchlistItem[] }).watchlist
      : [];
    userWatchlists.set(target.id, watchlist);
  }

  const allSymbols = [...new Set([...userWatchlists.values()].flat().map((w) => w.symbol))];
  const quotes = new Map<string, Quote>();
  await Promise.all(
    allSymbols.map(async (symbol) => {
      const quote = await fetchQuote(symbol);
      if (quote) quotes.set(symbol, quote);
    })
  );

  const today = new Date().toISOString().slice(0, 10);
  let alertsSent = 0;

  for (const target of targets) {
    const watchlist = userWatchlists.get(target.id) ?? [];
    for (const item of watchlist) {
      const quote = quotes.get(item.symbol);
      if (!quote) continue;

      const pctChange = ((quote.price - quote.previousClose) / quote.previousClose) * 100;
      const direction: "up" | "down" | null =
        pctChange >= MOVE_THRESHOLD_PCT ? "up" : pctChange <= -MOVE_THRESHOLD_PCT ? "down" : null;
      if (!direction) continue;

      const { error: insertError } = await supabaseAdmin.from("price_alerts_sent").insert({
        user_id: target.id,
        symbol: item.symbol,
        direction,
        alert_date: today,
      });
      // A unique-violation means today's alert for this symbol/direction
      // was already sent (by this run or an earlier one) - skip silently.
      if (insertError) continue;

      const arrow = direction === "up" ? "\u{1F4C8}" : "\u{1F4C9}";
      const label = item.name ? `${item.symbol} (${item.name})` : item.symbol;
      const text = `${arrow} ${label} is ${direction === "up" ? "up" : "down"} ${Math.abs(pctChange).toFixed(1)}% today (${quote.previousClose} → ${quote.price})`;

      const sent = await sendTelegramMessage(target.telegram_chat_id, text);
      if (sent) alertsSent++;
    }
  }

  return NextResponse.json({ usersChecked: targets.length, symbolsChecked: allSymbols.length, alertsSent });
}
