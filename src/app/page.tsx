"use client";

import { useState } from "react";
import { usePortfolio } from "@/lib/PortfolioProvider";
import {
  computeHoldings,
  computePerformanceSeries,
  computeSummary,
  computeYieldMetrics,
  scopedToPortfolio,
} from "@/lib/portfolio";
import { ALL_PORTFOLIOS } from "@/lib/types";
import { fetchDividendHistory } from "@/lib/dividends";
import { SummaryCards } from "@/components/SummaryCards";
import { AllocationChart } from "@/components/AllocationChart";
import { PerformanceChart } from "@/components/PerformanceChart";
import { HoldingsTable } from "@/components/HoldingsTable";
import { DividendsTable } from "@/components/DividendsTable";

export default function DashboardPage() {
  const { state, setDividendHistory } = usePortfolio();
  const [refreshingDividends, setRefreshingDividends] = useState(false);
  const [dividendError, setDividendError] = useState<string | null>(null);
  const [dividendsUpdatedAt, setDividendsUpdatedAt] = useState<string | null>(null);

  const scoped = scopedToPortfolio(state, state.activePortfolioId);
  const holdings = computeHoldings(scoped);
  const summary = computeSummary(holdings);
  const yieldMetrics = computeYieldMetrics(scoped, holdings);
  const performance = computePerformanceSeries(scoped, holdings);

  const activeName =
    state.activePortfolioId === ALL_PORTFOLIOS
      ? "All Portfolios"
      : (state.portfolios.find((p) => p.id === state.activePortfolioId)?.name ??
        "All Portfolios");

  async function handleRefreshDividends() {
    const symbols = [...new Set(scoped.transactions.map((t) => t.symbol))];
    if (symbols.length === 0) return;
    setRefreshingDividends(true);
    setDividendError(null);
    try {
      const { dividends, errors } = await fetchDividendHistory(symbols);
      if (Object.keys(dividends).length > 0) {
        setDividendHistory(dividends);
      }
      setDividendsUpdatedAt(new Date().toISOString());
      if (errors.length > 0 && Object.keys(dividends).length === 0) {
        setDividendError("Couldn't reach the dividend data provider right now.");
      } else if (errors.length > 0) {
        setDividendError(`No dividend history for: ${errors.join(", ")}`);
      }
    } catch {
      setDividendError("Couldn't reach the dividend data provider right now.");
    } finally {
      setRefreshingDividends(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-white">{activeName}</h1>
      <SummaryCards summary={summary} currency={state.currency} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PerformanceChart data={performance} currency={state.currency} />
        <AllocationChart holdings={holdings} currency={state.currency} />
      </div>
      <HoldingsTable holdings={holdings} currency={state.currency} yieldMetrics={yieldMetrics} />
      <DividendsTable
        holdings={holdings}
        currency={state.currency}
        onRefresh={handleRefreshDividends}
        refreshing={refreshingDividends}
        error={dividendError}
        updatedAt={dividendsUpdatedAt}
      />
    </div>
  );
}
