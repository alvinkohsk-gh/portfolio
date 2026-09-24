import { supabase } from "./supabaseClient";

export interface WatchlistNewsHeadline {
  title: string;
  source?: string;
  url?: string;
  summary?: string;
  publishedAt?: string;
}

export interface WatchlistNewsRow {
  symbol: string;
  name: string | null;
  market: string | null;
  status: string;
  flagged: boolean;
  headlines: WatchlistNewsHeadline[];
  note: string | null;
  updated_at: string;
}

export interface WatchlistNewsRun {
  ran_at: string;
  count: number;
}

/** Twice-daily watchlist news scan, run outside the app (not by this
 * codebase) and written straight into Supabase - this just reads what's
 * there. See src/app/watchlist-wire/page.tsx for the page that renders it. */
export async function fetchWatchlistNews(): Promise<{
  rows: WatchlistNewsRow[];
  run: WatchlistNewsRun | null;
}> {
  const [{ data: rows, error: rowsError }, { data: run, error: runError }] = await Promise.all([
    supabase.from("watchlist_news").select("*").order("symbol", { ascending: true }),
    supabase.from("watchlist_news_runs").select("ran_at, count").eq("id", "latest").maybeSingle(),
  ]);

  if (rowsError) throw rowsError;
  if (runError) throw runError;

  return {
    rows: (rows ?? []) as WatchlistNewsRow[],
    run: (run as WatchlistNewsRun | null) ?? null,
  };
}
