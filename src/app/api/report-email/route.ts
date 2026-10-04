import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { buildReportMessage, getMailer } from "@/lib/server/reportMailer";
import { ReportPeriod } from "@/lib/portfolio/report";
import { ALL_PORTFOLIOS, PortfolioState } from "@/lib/types";

export const dynamic = "force-dynamic";

const PERIODS: ReportPeriod[] = ["day", "week", "month"];

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/** Emails the signed-in user a report for one period. The recipient is
 * always the address saved on the caller's own profile (never taken from
 * the request), and the report is built here from their stored portfolio,
 * so this can only ever send a user their own data. */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return error("Not signed in.", 401);

  const mailer = getMailer();
  if (!mailer) {
    return error("Email sending isn't set up on the server yet (RESEND_API_KEY / DIGEST_FROM_EMAIL).", 503);
  }

  const admin = getSupabaseAdmin();
  const {
    data: { user },
  } = await admin.auth.getUser(token);
  if (!user) return error("Your session has expired. Sign in again.", 401);

  let body: { period?: unknown; anchor?: unknown; portfolioId?: unknown };
  try {
    body = await req.json();
  } catch {
    return error("Invalid request.", 400);
  }
  const period = body.period as ReportPeriod;
  const anchor = body.anchor;
  const portfolioId = typeof body.portfolioId === "string" ? body.portfolioId : ALL_PORTFOLIOS;
  if (!PERIODS.includes(period) || typeof anchor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    return error("Invalid report period.", 400);
  }

  const [{ data: profile, error: profileError }, { data: row, error: rowError }] = await Promise.all([
    admin.from("profiles").select("notify_email").eq("id", user.id).maybeSingle(),
    admin.from("portfolio_data").select("state").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profileError || rowError) return error("Couldn't load your account data.", 500);

  const to = profile?.notify_email as string | null | undefined;
  if (!to) return error("Add an email address in Settings first.", 400);
  if (!row?.state) return error("No portfolio data to report on yet.", 400);

  const state = row.state as PortfolioState;
  if (portfolioId !== ALL_PORTFOLIOS && !(state.portfolios ?? []).some((p) => p.id === portfolioId)) {
    return error("Unknown portfolio.", 400);
  }

  const message = buildReportMessage(state, period, anchor, portfolioId);
  const { error: sendError } = await mailer.resend.emails.send({
    from: mailer.from,
    to,
    subject: message.subject,
    html: message.html,
    attachments: [message.attachment],
  });
  if (sendError) return error(`Email failed to send: ${sendError.message}`, 502);

  return NextResponse.json({ sentTo: to });
}
