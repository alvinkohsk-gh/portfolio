"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePortfolio } from "@/lib/PortfolioProvider";
import {
  activeCurrency,
  computePeriodReport,
  computePeriodTrend,
  currencyForPortfolio,
  periodLabel,
  periodRange,
  ReportPeriod,
  scopedToPortfolio,
  shiftAnchor,
  todayIso,
} from "@/lib/portfolio";
import { ALL_PORTFOLIOS, Transaction } from "@/lib/types";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatSignedCurrency,
  gainColorClass,
} from "@/lib/format";
import { Card, CardTitle } from "@/components/Card";

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const typeStyles: Record<Transaction["type"], string> = {
  BUY: "bg-emerald-500/15 text-emerald-400",
  SELL: "bg-rose-500/15 text-rose-400",
  DIVIDEND: "bg-blue-500/15 text-blue-400",
};

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function StatCard({
  label,
  value,
  sub,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={clsx("text-lg sm:text-xl font-semibold tabular-nums mt-1", valueClass)}>{value}</div>
      {sub && <div className="text-xs text-neutral-500 mt-0.5">{sub}</div>}
    </Card>
  );
}

export default function ReportsPage() {
  const { state } = usePortfolio();
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [anchor, setAnchor] = useState<string>(() => todayIso());

  const scoped = useMemo(() => scopedToPortfolio(state, state.activePortfolioId), [state]);
  const currency = activeCurrency(state);
  const showPortfolioColumn = state.activePortfolioId === ALL_PORTFOLIOS;
  const portfolioName = (id: string) => state.portfolios.find((p) => p.id === id)?.name ?? "—";

  const range = periodRange(period, anchor);
  const { start, end } = range;
  const report = useMemo(() => computePeriodReport(scoped, { start, end }), [scoped, start, end]);
  const trend = useMemo(() => computePeriodTrend(scoped, period, anchor), [scoped, period, anchor]);

  const today = todayIso();
  const isCurrent = today >= range.start && today <= range.end;
  const net = report.realizedGain + report.dividends;
  const closedLots = report.realizedEvents.length;

  function exportCsv() {
    const header = ["Date", "Portfolio", "Type", "Symbol", "Name", "Quantity", "Price", "Fees", "Total", "Realized"];
    const rows = report.transactions.map((t) => {
      const total =
        t.type === "DIVIDEND"
          ? t.price
          : t.quantity * t.price + (t.fees ?? 0) * (t.type === "BUY" ? 1 : -1);
      const realized = report.realizedByTxId[t.id];
      return [
        t.date,
        portfolioName(t.portfolioId),
        t.type,
        t.symbol,
        t.name ?? "",
        t.quantity,
        t.price,
        t.fees ?? 0,
        Number(total.toFixed(2)),
        realized != null ? Number(realized.toFixed(2)) : "",
      ];
    });
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${period}-${range.start}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">Reports</h1>
        <div className="flex items-center gap-1 rounded-lg bg-neutral-900 border border-neutral-800 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={clsx(
                "px-3 py-1.5 rounded-md text-sm font-medium",
                period === p.value ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setAnchor(shiftAnchor(period, anchor, -1))}
          aria-label="Previous period"
          className="px-2.5 py-1.5 rounded-md border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
        >
          ←
        </button>
        <div className="min-w-[12rem] text-center text-base font-medium text-white">
          {periodLabel(period, anchor)}
        </div>
        <button
          onClick={() => setAnchor(shiftAnchor(period, anchor, 1))}
          disabled={range.end >= today}
          aria-label="Next period"
          className="px-2.5 py-1.5 rounded-md border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          →
        </button>
        {!isCurrent && (
          <button
            onClick={() => setAnchor(today)}
            className="px-3 py-1.5 rounded-md text-sm text-neutral-300 border border-neutral-700 hover:bg-neutral-800"
          >
            {period === "day" ? "Today" : period === "week" ? "This week" : "This month"}
          </button>
        )}
        <input
          type="date"
          value={anchor}
          max={today}
          onChange={(e) => e.target.value && setAnchor(e.target.value)}
          aria-label="Jump to date"
          className="ml-auto rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-sm text-white [color-scheme:dark]"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Net result (realized + dividends)"
          value={formatSignedCurrency(net, currency)}
          valueClass={gainColorClass(net)}
        />
        <StatCard
          label="Realized P&L"
          value={formatSignedCurrency(report.realizedGain, currency)}
          valueClass={gainColorClass(report.realizedGain)}
          sub={
            closedLots === 0
              ? "No positions closed"
              : `${closedLots} closed lot${closedLots === 1 ? "" : "s"}${
                  report.stats.winRatePct != null
                    ? ` · ${formatPercent(report.stats.winRatePct, 0).replace("+", "")} win rate`
                    : ""
                }`
          }
        />
        <StatCard
          label="Dividends"
          value={formatCurrency(report.dividends, currency)}
          valueClass={report.dividends > 0 ? "text-blue-400" : "text-white"}
          sub={report.dividendCount > 0 ? `${report.dividendCount} payment${report.dividendCount === 1 ? "" : "s"}` : undefined}
        />
        <StatCard
          label="Fees paid"
          value={formatCurrency(report.fees, currency)}
        />
        <StatCard
          label="Bought"
          value={formatCurrency(report.bought, currency)}
          sub={`${report.buyCount} buy${report.buyCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Sold"
          value={formatCurrency(report.sold, currency)}
          sub={`${report.sellCount} sell${report.sellCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Net cash flow"
          value={formatSignedCurrency(report.sold + report.dividends - report.bought, currency)}
          sub="Sells + dividends − buys"
        />
        <StatCard
          label="Best / worst trade"
          value={
            closedLots === 0
              ? "—"
              : `${report.stats.biggestWin != null ? formatCurrency(report.stats.biggestWin, currency) : "—"} / ${
                  report.stats.biggestLoss != null ? formatCurrency(report.stats.biggestLoss, currency) : "—"
                }`
          }
        />
      </div>

      <Card>
        <CardTitle>
          Net result, last 12 {period === "day" ? "days" : period === "week" ? "weeks" : "months"}
        </CardTitle>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#262626" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "#737373", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(v: number) => formatCurrency(v, currency).replace(/\.\d+$/, "")}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#e5e5e5" }}
                formatter={(value, name) => [
                  formatCurrency(Number(value), currency),
                  name === "net" ? "Net result" : String(name),
                ]}
              />
              <Bar
                dataKey="net"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(d) => {
                  const a = (d as { payload?: { anchor?: string } }).payload?.anchor;
                  if (a) setAnchor(a);
                }}
              >
                {trend.map((p) => (
                  <Cell
                    key={p.anchor}
                    fill={p.net >= 0 ? "#34d399" : "#fb7185"}
                    fillOpacity={p.anchor === range.start ? 1 : 0.45}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[11px] text-neutral-600 mt-2">Click a bar to open that period.</div>
      </Card>

      {report.bySymbol.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 sm:px-5 pt-4 sm:pt-5">
            <CardTitle>By stock</CardTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Bought</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Sold</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Realized</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Dividends</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Txns</th>
                </tr>
              </thead>
              <tbody>
                {report.bySymbol.map((r) => (
                  <tr key={r.symbol} className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40">
                    <td className="px-4 sm:px-5 py-3">
                      <Link
                        href={`/transactions?symbol=${encodeURIComponent(r.symbol)}`}
                        className="font-medium text-white hover:text-emerald-400 hover:underline"
                      >
                        {r.symbol}
                      </Link>
                      {r.name && <div className="text-xs text-neutral-500 truncate max-w-[160px]">{r.name}</div>}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                      {r.bought > 0 ? formatCurrency(r.bought, currency) : "—"}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                      {r.sold > 0 ? formatCurrency(r.sold, currency) : "—"}
                    </td>
                    <td className={clsx("px-4 sm:px-5 py-3 text-right tabular-nums", gainColorClass(r.realized))}>
                      {r.realized !== 0 ? formatSignedCurrency(r.realized, currency) : "—"}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                      {r.dividends > 0 ? formatCurrency(r.dividends, currency) : "—"}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">{r.transactions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 flex items-center justify-between gap-3">
          <CardTitle>Transactions ({report.transactions.length})</CardTitle>
          {report.transactions.length > 0 && (
            <button
              onClick={exportCsv}
              className="mb-3 px-2.5 py-1 rounded-md text-xs text-neutral-300 border border-neutral-700 hover:bg-neutral-800"
            >
              Export CSV
            </button>
          )}
        </div>
        {report.transactions.length === 0 ? (
          <div className="h-28 flex items-center justify-center text-sm text-neutral-500">
            No transactions in this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Date</th>
                  {showPortfolioColumn && <th className="px-4 sm:px-5 py-2.5 font-medium">Portfolio</th>}
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Type</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Quantity</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Price</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Total</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Realized</th>
                </tr>
              </thead>
              <tbody>
                {report.transactions.map((t) => {
                  const txCurrency = currencyForPortfolio(state, t.portfolioId);
                  const total =
                    t.type === "DIVIDEND"
                      ? t.price
                      : t.quantity * t.price + (t.fees ?? 0) * (t.type === "BUY" ? 1 : -1);
                  const realized = report.realizedByTxId[t.id];
                  return (
                    <tr key={t.id} className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40">
                      <td className="px-4 sm:px-5 py-3 text-neutral-300 whitespace-nowrap">{formatDate(t.date)}</td>
                      {showPortfolioColumn && (
                        <td className="px-4 sm:px-5 py-3 text-neutral-300 whitespace-nowrap">
                          {portfolioName(t.portfolioId)}
                        </td>
                      )}
                      <td className="px-4 sm:px-5 py-3">
                        <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", typeStyles[t.type])}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <div className="font-medium text-white">{t.symbol}</div>
                        {t.name && <div className="text-xs text-neutral-500">{t.name}</div>}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">{t.quantity}</td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {formatCurrency(t.price, txCurrency)}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-white">
                        {formatCurrency(total, txCurrency)}
                      </td>
                      <td
                        className={clsx(
                          "px-4 sm:px-5 py-3 text-right tabular-nums",
                          realized != null ? gainColorClass(realized) : "text-neutral-600"
                        )}
                      >
                        {realized != null ? formatSignedCurrency(realized, txCurrency) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-neutral-600">
        Realized P&amp;L uses average cost, so a sale&apos;s gain reflects all earlier buys even if they fall
        outside this period. Dividends count only payments logged as transactions.
      </p>
    </div>
  );
}
