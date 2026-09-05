"use client";

import { usePortfolio } from "@/lib/PortfolioProvider";
import { computeHoldings, computePerformanceSeries, computeSummary } from "@/lib/portfolio";
import { SummaryCards } from "@/components/SummaryCards";
import { AllocationChart } from "@/components/AllocationChart";
import { PerformanceChart } from "@/components/PerformanceChart";
import { HoldingsTable } from "@/components/HoldingsTable";

export default function DashboardPage() {
  const { state } = usePortfolio();

  const holdings = computeHoldings(state);
  const summary = computeSummary(holdings);
  const performance = computePerformanceSeries(state, holdings);

  return (
    <div className="flex flex-col gap-5">
      <SummaryCards summary={summary} currency={state.currency} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PerformanceChart data={performance} currency={state.currency} />
        <AllocationChart holdings={holdings} currency={state.currency} />
      </div>
      <HoldingsTable holdings={holdings} currency={state.currency} />
    </div>
  );
}
