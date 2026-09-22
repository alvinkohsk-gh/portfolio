import { NextRequest, NextResponse } from "next/server";
import { fetchAnnouncementsForSymbols } from "@/lib/server/newsSources";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const namesParam = req.nextUrl.searchParams.get("names") ?? "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim()).filter(Boolean))];
  const names = namesParam.split(",").map((n) => decodeURIComponent(n.trim()));

  const result = await fetchAnnouncementsForSymbols(symbols, names);
  return NextResponse.json(result);
}
