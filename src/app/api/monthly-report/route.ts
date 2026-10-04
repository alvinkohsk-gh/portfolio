import { NextRequest, NextResponse } from "next/server";
import { sendMonthlyReports } from "@/lib/server/reportMailer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Manual trigger for the monthly report send (the scheduled run piggybacks
 * on the digest cron on the 1st). Same CRON_SECRET bearer auth as the
 * other cron routes. Sends last month's report to every user. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await sendMonthlyReports(new Date()));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
