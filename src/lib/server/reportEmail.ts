import { PeriodReport, transactionTotal } from "@/lib/portfolio/report";
import { formatCurrency, formatDate, formatPercent, formatSignedCurrency } from "@/lib/format";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

const GREEN = "#047857";
const RED = "#be123c";
const MUTED = "#6b7280";
const INK = "#111827";

const signColor = (v: number) => (v > 0 ? GREEN : v < 0 ? RED : INK);

function stat(label: string, value: string, color = INK, sub?: string): string {
  return `<td style="width:50%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;vertical-align:top;">
    <div style="font-size:11px;color:${MUTED};">${escapeHtml(label)}</div>
    <div style="font-size:18px;font-weight:700;color:${color};margin-top:2px;">${escapeHtml(value)}</div>
    ${sub ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">${escapeHtml(sub)}</div>` : ""}
  </td>`;
}

const th = (label: string, right = false) =>
  `<th style="text-align:${right ? "right" : "left"};font-size:11px;font-weight:600;color:${MUTED};padding:6px 8px;border-bottom:1px solid #e5e7eb;">${label}</th>`;
const td = (html: string, right = false, color = INK) =>
  `<td style="text-align:${right ? "right" : "left"};font-size:13px;color:${color};padding:6px 8px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${html}</td>`;

export function renderReportEmail(opts: {
  report: PeriodReport;
  periodLabel: string;
  portfolioLabel: string;
  currency: string;
  portfolioName: (id: string) => string;
  showPortfolioColumn: boolean;
}): { subject: string; html: string } {
  const { report, periodLabel, portfolioLabel, currency, portfolioName, showPortfolioColumn } = opts;
  const net = report.realizedGain + report.dividends;
  const closed = report.realizedEvents.length;
  const money = (v: number) => formatCurrency(v, currency);

  const realizedSub =
    closed === 0
      ? "No positions closed"
      : `${closed} closed lot${closed === 1 ? "" : "s"}${
          report.stats.winRatePct != null ? ` · ${formatPercent(report.stats.winRatePct, 0).replace("+", "")} win rate` : ""
        }`;

  const stats = `<table role="presentation" style="width:100%;border-collapse:separate;border-spacing:6px;">
    <tr>${stat("Net result (realized + dividends)", formatSignedCurrency(net, currency), signColor(net))}${stat(
      "Realized P&L",
      formatSignedCurrency(report.realizedGain, currency),
      signColor(report.realizedGain),
      realizedSub
    )}</tr>
    <tr>${stat("Dividends", money(report.dividends))}${stat("Fees paid", money(report.fees))}</tr>
    <tr>${stat("Bought", money(report.bought), INK, `${report.buyCount} buy${report.buyCount === 1 ? "" : "s"}`)}${stat(
      "Sold",
      money(report.sold),
      INK,
      `${report.sellCount} sell${report.sellCount === 1 ? "" : "s"}`
    )}</tr>
  </table>`;

  const bySymbol =
    report.bySymbol.length === 0
      ? ""
      : `<h3 style="font-size:14px;color:${INK};margin:20px 0 6px;">By stock</h3>
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr>${th("Symbol")}${th("Bought", true)}${th("Sold", true)}${th("Realized", true)}${th("Dividends", true)}</tr>
      ${report.bySymbol
        .map(
          (r) => `<tr>
        ${td(`<strong>${escapeHtml(r.symbol)}</strong>${r.name ? `<div style="font-size:11px;color:${MUTED};">${escapeHtml(r.name)}</div>` : ""}`)}
        ${td(r.bought > 0 ? money(r.bought) : "—", true)}
        ${td(r.sold > 0 ? money(r.sold) : "—", true)}
        ${td(r.realized !== 0 ? formatSignedCurrency(r.realized, currency) : "—", true, signColor(r.realized))}
        ${td(r.dividends > 0 ? money(r.dividends) : "—", true)}
      </tr>`
        )
        .join("")}
    </table>`;

  const txns =
    report.transactions.length === 0
      ? `<p style="font-size:13px;color:${MUTED};">No transactions in this period.</p>`
      : `<table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr>${th("Date")}${showPortfolioColumn ? th("Portfolio") : ""}${th("Type")}${th("Symbol")}${th("Qty", true)}${th(
        "Price",
        true
      )}${th("Total", true)}${th("Realized", true)}</tr>
      ${report.transactions
        .map((t) => {
          const realized = report.realizedByTxId[t.id];
          return `<tr>
          ${td(escapeHtml(formatDate(t.date)))}
          ${showPortfolioColumn ? td(escapeHtml(portfolioName(t.portfolioId))) : ""}
          ${td(t.type)}
          ${td(`<strong>${escapeHtml(t.symbol)}</strong>`)}
          ${td(String(t.quantity), true)}
          ${td(money(t.price), true)}
          ${td(money(transactionTotal(t)), true)}
          ${td(realized != null ? formatSignedCurrency(realized, currency) : "—", true, realized != null ? signColor(realized) : MUTED)}
        </tr>`;
        })
        .join("")}
    </table>`;

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:${INK};">
    <h1 style="font-size:20px;margin:0 0 2px;">Portfolio report: ${escapeHtml(periodLabel)}</h1>
    <p style="font-size:12px;color:${MUTED};margin:0 0 14px;">${escapeHtml(portfolioLabel)}</p>
    ${stats}
    ${bySymbol}
    <h3 style="font-size:14px;color:${INK};margin:20px 0 6px;">Transactions (${report.transactions.length})</h3>
    ${txns}
    <p style="font-size:11px;color:#9ca3af;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
      Realized P&amp;L uses average cost. Dividends count only payments logged as transactions.
      The full transaction list is attached as CSV. Not investment advice.
    </p>
  </div>`;

  return { subject: `Portfolio report: ${periodLabel}`, html };
}
