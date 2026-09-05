"use client";

import { usePortfolio } from "@/lib/PortfolioProvider";
import {
  computeHoldings,
  computePerformanceSeries,
  computeSummary,
  scopedToPortfolio,
} from "@/lib/portfolio";
import { ALL_PORTFOLIOS } from "@/lib/types";
import { SummaryCards } from "@/components/SummaryCards";
import { AllocationChart } from "@/components/AllocationChart";
import { PerformanceChart } from "@/components/PerformanceChart";
import { HoldingsTable } from "@/components/HoldingsTable";
import { DividendsTable } from "@/components/DividendsTable";

export default function DashboardPage() {
  const { state } = usePortfolio();

  const scoped = scopedToPortfolio(state, state.activePortfolioId);
  const holdings = computeHoldings(scoped);
  const summary = computeSummary(holdings);
  const performance = computePerformanceSeries(scoped, holdings);

  const activeName =
    state.activePortfolioId === ALL_PORTFOLIOS
      ? "All Portfolios"
      : (state.portfolios.find((p) => p.id === state.activePortfolioId)?.name ??
        "All Portfolios");

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-white">{activeName}</h1>
      <SummaryCards summary={summary} currency={state.currency} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PerformanceChart data={performance} currency={state.currency} />
        <AllocationChart holdings={holdings} currency={state.currency} />
      </div>
      <HoldingsTable holdings={holdings} currency={state.currency} />
      <DividendsTable holdings={holdings} currency={state.currency} />
    </div>
  );
}
