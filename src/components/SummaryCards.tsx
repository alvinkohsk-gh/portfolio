import { PortfolioSummary } from "@/lib/types";
import { formatCurrency, formatPercent, formatSignedCurrency, gainColorClass } from "@/lib/format";
import { Card } from "./Card";

export function SummaryCards({
  summary,
  currency,
}: {
  summary: PortfolioSummary;
  currency: string;
}) {
  const items = [
    {
      label: "Portfolio Value",
      value: formatCurrency(summary.totalValue, currency),
      sub: `${summary.holdingsCount} holding${summary.holdingsCount === 1 ? "" : "s"}`,
      subClass: "text-neutral-500",
    },
    {
      label: "Total Gain / Loss",
      value: formatSignedCurrency(summary.totalGain, currency),
      sub: formatPercent(summary.totalGainPct),
      subClass: gainColorClass(summary.totalGain),
      valueClass: gainColorClass(summary.totalGain),
    },
    {
      label: "Today",
      value: formatSignedCurrency(summary.dayChange, currency),
      sub: formatPercent(summary.dayChangePct),
      subClass: gainColorClass(summary.dayChange),
      valueClass: gainColorClass(summary.dayChange),
    },
    {
      label: "Dividends Received",
      value: formatCurrency(summary.totalDividends, currency),
      sub:
        summary.totalRealizedGain !== 0
          ? `${formatSignedCurrency(summary.totalRealizedGain, currency)} realized`
          : "Lifetime",
      subClass: gainColorClass(summary.totalRealizedGain),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <div className="text-xs font-medium text-neutral-500">{item.label}</div>
          <div
            className={`mt-1.5 text-xl sm:text-2xl font-semibold tabular-nums ${item.valueClass ?? "text-white"}`}
          >
            {item.value}
          </div>
          <div className={`mt-1 text-xs font-medium tabular-nums ${item.subClass}`}>
            {item.sub}
          </div>
        </Card>
      ))}
    </div>
  );
}
