import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { Announcement, fetchAnnouncementsForSymbols } from "@/lib/server/newsSources";
import { MonthlyReportResult, sendMonthlyReports } from "@/lib/server/reportMailer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface WatchlistItem {
  symbol: string;
  name?: string;
}

/** An Announcement, or a headline from the Watchlist Wire scan (whose
 * sources are free-form publisher names rather than the fixed feed list). */
type DigestItem = Omit<Announcement, "source"> & { source: string };

interface WireHeadline {
  title?: string;
  source?: string;
  url?: string;
  summary?: string;
  publishedAt?: string;
}

/** Headlines from the twice-daily Watchlist Wire scan, which is written
 * straight into watchlist_news by a job outside this codebase. Shared across
 * users, so each digest picks out its own watchlist's symbols. */
async function fetchWireHeadlines(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
): Promise<Map<string, DigestItem[]>> {
  const { data, error } = await supabaseAdmin
    .from("watchlist_news")
    .select("symbol, headlines, updated_at");
  if (error) throw error;
  const bySymbol = new Map<string, DigestItem[]>();
  for (const row of data ?? []) {
    const headlines = Array.isArray(row.headlines) ? (row.headlines as WireHeadline[]) : [];
    const items = headlines
      .filter((h) => h?.title)
      .map((h) => ({
        date: (h.publishedAt || String(row.updated_at ?? "")).slice(0, 10),
        title: h.title!,
        source: h.source ? `${h.source} · Watchlist Wire` : "Watchlist Wire",
        link: h.url,
        summary: h.summary,
      }));
    if (items.length > 0) bySymbol.set(String(row.symbol).toUpperCase(), items);
  }
  return bySymbol;
}

// Caps keep one very chatty stock (or a large watchlist) from producing a
// single unreadable wall-of-links email.
const MAX_ITEMS_PER_SYMBOL = 5;
const MAX_ITEMS_PER_EMAIL = 40;

function itemKey(item: DigestItem): string {
  const basis = item.link || item.title;
  return createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderDigestHtml(bySymbol: Map<string, DigestItem[]>): string {
  const sections = [...bySymbol.entries()]
    .map(([symbol, items]) => {
      const rows = items
        .map((a) => {
          const title = a.link
            ? `<a href="${escapeHtml(a.link)}" style="color:#0f766e;text-decoration:none;">${escapeHtml(a.title)}</a>`
            : escapeHtml(a.title);
          return `<li style="margin-bottom:8px;">
            <div style="font-size:13.5px;font-weight:600;color:#111827;">${title}</div>
            <div style="font-size:11.5px;color:#6b7280;">${escapeHtml(a.source)}${a.date ? " · " + escapeHtml(a.date) : ""}</div>
            ${a.summary ? `<div style="font-size:12.5px;color:#374151;margin-top:2px;">${escapeHtml(a.summary)}</div>` : ""}
          </li>`;
        })
        .join("");
      return `<div style="margin-bottom:20px;">
        <div style="font-family:ui-monospace,monospace;font-weight:700;font-size:14px;color:#0f172a;margin-bottom:6px;">${escapeHtml(symbol)}</div>
        <ul style="list-style:none;padding:0;margin:0;">${rows}</ul>
      </div>`;
    })
    .join("");

  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h1 style="font-size:18px;color:#0f172a;margin:0 0 4px;">Watchlist digest</h1>
    <p style="font-size:12px;color:#6b7280;margin:0 0 20px;">New items since your last digest, across your watchlist.</p>
    ${sections}
    <p style="font-size:11px;color:#9ca3af;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
      Automated scan of public sources (SEC EDGAR, Nasdaq, Yahoo Finance, Google News, SGX) plus the Watchlist Wire news scan - not investment advice,
      and coverage may be incomplete. Manage your digest email address in Settings.
    </p>
  </div>`;
}

/** Runs on a Vercel Cron schedule (see vercel.json) - Vercel automatically
 * sends "Authorization: Bearer <CRON_SECRET>" when that env var is set, so
 * this is the only auth check needed to keep the route from being triggered
 * by anyone who finds the URL. */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.DIGEST_FROM_EMAIL;
  if (!resendKey || !fromAddress) {
    return NextResponse.json(
      { error: "RESEND_API_KEY/DIGEST_FROM_EMAIL are not configured." },
      { status: 500 }
    );
  }
  const resend = new Resend(resendKey);
  const supabaseAdmin = getSupabaseAdmin();

  // The monthly report rides on this cron's 01:00 UTC (9am SGT) run on the
  // 1st rather than a cron entry of its own. It runs first and catches its
  // own errors, so the digest and the monthly report can't block each other.
  const now = new Date();
  let monthlyReport: MonthlyReportResult | { error: string } | undefined;
  if (now.getUTCDate() === 1 && now.getUTCHours() < 5) {
    try {
      monthlyReport = await sendMonthlyReports(now);
    } catch (err) {
      monthlyReport = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, notify_email")
    .not("notify_email", "is", null);
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message, monthlyReport }, { status: 500 });
  }

  const targets = (profiles ?? []).filter(
    (p): p is { id: string; notify_email: string } => !!p.notify_email
  );

  // A Wire outage shouldn't cost users the rest of their digest.
  let wireHeadlines = new Map<string, DigestItem[]>();
  let wireError: string | undefined;
  try {
    wireHeadlines = await fetchWireHeadlines(supabaseAdmin);
  } catch (err) {
    wireError = err instanceof Error ? err.message : String(err);
  }

  const summary: Array<{ userId: string; sent: boolean; newItems: number; error?: string }> = [];

  for (const target of targets) {
    try {
      const { data: portfolioRow, error: portfolioError } = await supabaseAdmin
        .from("portfolio_data")
        .select("state")
        .eq("user_id", target.id)
        .maybeSingle();
      if (portfolioError) throw portfolioError;

      const watchlist: WatchlistItem[] = Array.isArray(
        (portfolioRow?.state as { watchlist?: unknown })?.watchlist
      )
        ? ((portfolioRow!.state as { watchlist: WatchlistItem[] }).watchlist)
        : [];
      if (watchlist.length === 0) {
        summary.push({ userId: target.id, sent: false, newItems: 0 });
        continue;
      }

      const symbols = watchlist.map((w) => w.symbol);
      const names = watchlist.map((w) => w.name ?? "");
      const { announcements } = await fetchAnnouncementsForSymbols(symbols, names);

      const { data: alreadySent, error: sentError } = await supabaseAdmin
        .from("digest_sent_items")
        .select("symbol, item_key")
        .eq("user_id", target.id);
      if (sentError) throw sentError;
      const sentKeys = new Set((alreadySent ?? []).map((r) => `${r.symbol}:${r.item_key}`));

      const bySymbol = new Map<string, DigestItem[]>();
      const toRecord: { user_id: string; symbol: string; item_key: string }[] = [];
      let totalNew = 0;

      for (const symbol of symbols) {
        // Wire headlines first: they're the hand-picked, summarized ones.
        const items: DigestItem[] = [
          ...(wireHeadlines.get(symbol.toUpperCase()) ?? []),
          ...(announcements[symbol] ?? []),
        ];
        const fresh: DigestItem[] = [];
        for (const item of items) {
          const key = itemKey(item);
          if (sentKeys.has(`${symbol}:${key}`)) continue;
          // The Wire and the feeds can surface the same article.
          sentKeys.add(`${symbol}:${key}`);
          fresh.push(item);
          toRecord.push({ user_id: target.id, symbol, item_key: key });
          if (fresh.length >= MAX_ITEMS_PER_SYMBOL) break;
        }
        if (fresh.length > 0) {
          bySymbol.set(symbol, fresh);
          totalNew += fresh.length;
        }
        if (totalNew >= MAX_ITEMS_PER_EMAIL) break;
      }

      if (totalNew === 0) {
        summary.push({ userId: target.id, sent: false, newItems: 0 });
        continue;
      }

      const { error: sendError } = await resend.emails.send({
        from: fromAddress,
        to: target.notify_email,
        subject: `Watchlist digest: ${totalNew} new item${totalNew === 1 ? "" : "s"}`,
        html: renderDigestHtml(bySymbol),
      });
      if (sendError) throw new Error(sendError.message);

      // Only record as sent after the email actually goes out, so a failed
      // send retries with the same items on the next run instead of
      // silently losing them.
      const { error: recordError } = await supabaseAdmin
        .from("digest_sent_items")
        .insert(toRecord.slice(0, MAX_ITEMS_PER_EMAIL));
      if (recordError) throw recordError;

      summary.push({ userId: target.id, sent: true, newItems: totalNew });
    } catch (err) {
      summary.push({
        userId: target.id,
        sent: false,
        newItems: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ usersProcessed: targets.length, results: summary, monthlyReport, wireError });
}
