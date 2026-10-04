import { Resend } from "resend";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { renderReportEmail } from "./reportEmail";
import {
  computePeriodReport,
  PeriodReport,
  periodLabel,
  periodRange,
  ReportPeriod,
  reportToCsv,
  shiftAnchor,
} from "@/lib/portfolio/report";
import { currencyForPortfolio, scopedToPortfolio } from "@/lib/portfolio/scope";
import { migrate } from "@/lib/store";
import { ALL_PORTFOLIOS, PortfolioState } from "@/lib/types";

export interface ReportMessage {
  report: PeriodReport;
  subject: string;
  html: string;
  attachment: { filename: string; content: Buffer };
}

export function buildReportMessage(
  rawState: PortfolioState,
  period: ReportPeriod,
  anchor: string,
  portfolioId: string
): ReportMessage {
  const state = migrate(rawState);
  const portfolioName = (id: string) => state.portfolios.find((p) => p.id === id)?.name ?? "—";
  const range = periodRange(period, anchor);
  const report = computePeriodReport(scopedToPortfolio(state, portfolioId), range);
  const { subject, html } = renderReportEmail({
    report,
    periodLabel: periodLabel(period, anchor),
    portfolioLabel: portfolioId === ALL_PORTFOLIOS ? "All Portfolios" : portfolioName(portfolioId),
    currency: portfolioId === ALL_PORTFOLIOS ? state.currency : currencyForPortfolio(state, portfolioId),
    portfolioName,
    showPortfolioColumn: portfolioId === ALL_PORTFOLIOS,
  });
  return {
    report,
    subject,
    html,
    attachment: {
      filename: `report-${period}-${range.start}.csv`,
      content: Buffer.from(reportToCsv(report, portfolioName)),
    },
  };
}

export function getMailer(): { resend: Resend; from: string } | null {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL;
  return key && from ? { resend: new Resend(key), from } : null;
}

/** First day of the month before `now`'s month, in UTC. */
export function previousMonthAnchor(now: Date): string {
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  return shiftAnchor("month", thisMonth, -1);
}

export interface MonthlyReportResult {
  month: string;
  results: Array<{ userId: string; sent: boolean; reason?: string }>;
}

/** Emails every user with a saved notify_email their report for the
 * previous calendar month, across all their portfolios. Users with no
 * transactions that month are skipped rather than sent an empty report. */
export async function sendMonthlyReports(now: Date): Promise<MonthlyReportResult> {
  const mailer = getMailer();
  if (!mailer) throw new Error("RESEND_API_KEY/DIGEST_FROM_EMAIL are not configured.");
  const anchor = previousMonthAnchor(now);
  const admin = getSupabaseAdmin();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, notify_email")
    .not("notify_email", "is", null);
  if (error) throw error;

  const results: MonthlyReportResult["results"] = [];
  for (const profile of profiles ?? []) {
    const userId = profile.id as string;
    const to = profile.notify_email as string | null;
    if (!to) continue;
    try {
      const { data: row, error: rowError } = await admin
        .from("portfolio_data")
        .select("state")
        .eq("user_id", userId)
        .maybeSingle();
      if (rowError) throw rowError;
      if (!row?.state) {
        results.push({ userId, sent: false, reason: "no portfolio data" });
        continue;
      }
      const message = buildReportMessage(row.state as PortfolioState, "month", anchor, ALL_PORTFOLIOS);
      if (message.report.transactions.length === 0) {
        results.push({ userId, sent: false, reason: "no transactions that month" });
        continue;
      }
      const { error: sendError } = await mailer.resend.emails.send({
        from: mailer.from,
        to,
        subject: message.subject,
        html: message.html,
        attachments: [message.attachment],
      });
      if (sendError) throw new Error(sendError.message);
      results.push({ userId, sent: true });
    } catch (err) {
      results.push({ userId, sent: false, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return { month: anchor.slice(0, 7), results };
}
