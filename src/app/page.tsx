"use client";

import { useEffect, useState } from "react";
import { usePortfolio } from "@/lib/PortfolioProvider";
import {
  activeCurrency,
  allSymbols,
  computeHoldings,
  computePerformanceSeries,
  computeSummary,
  computeYieldMetrics,
  scopedToPortfolio,
  symbolNames,
} from "@/lib/portfolio";
import { ALL_PORTFOLIOS } from "@/lib/types";
import { fetchDividendHistory } from "@/lib/dividends";
import { fetchSectors } from "@/lib/sectors";
import { MarketIndices } from "@/components/MarketIndices";
import { MoversPanel } from "@/components/MoversPanel";
import { SummaryCards } from "@/components/SummaryCards";
import { AllocationChart } from "@/components/AllocationChart";
import { PerformanceChart } from "@/components/PerformanceChart";
import { HoldingsTable } from "@/components/HoldingsTable";
import { DividendsTable } from "@/components/DividendsTable";
import { DividendCalendar } from "@/components/DividendCalendar";
import { SectorConcentration } from "@/components/SectorConcentration";

export default function DashboardPage() {
  const { state, setDividendHistory, setSectors } = usePortfolio();
  const [refreshingDividends, setRefreshingDividends] = useState(false);
  const [dividendError, setDividendError] = useState<string | null>(null);
  const [dividendsUpdatedAt, setDividendsUpdatedAt] = useState<string | null>(null);

  const scoped = scopedToPortfolio(state, state.activePortfolioId);
  const holdings = computeHoldings(scoped);
  const summary = computeSummary(holdings);
  const yieldMetrics = computeYieldMetrics(scoped, holdings);
  const performance = computePerformanceSeries(scoped, holdings);
  const currency = activeCurrency(state);
  const trackedSymbols = allSymbols(state);
  const trackedNames = symbolNames(state);

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

  // Sectors rarely change, so this only fetches symbols not already cached
  // in state - a symbol closed out and reopened, or shared across
  // portfolios, is fetched once and reused from then on.
  const openSymbols = holdings
    .filter((h) => h.quantity > 0)
    .map((h) => h.symbol)
    .sort()
    .join(",");
  useEffect(() => {
    const missing = openSymbols.split(",").filter((s) => s && !state.sectors[s]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const { sectors } = await fetchSectors(missing);
      if (!cancelled && Object.keys(sectors).length > 0) setSectors(sectors);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSymbols]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-white">{activeName}</h1>
      <MarketIndices />
      <MoversPanel symbols={trackedSymbols} names={trackedNames} />
      <SummaryCards summary={summary} currency={currency} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PerformanceChart data={performance} currency={currency} />
        <AllocationChart holdings={holdings} currency={currency} sectors={state.sectors} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectorConcentration holdings={holdings} sectors={state.sectors} />
        <DividendCalendar
          holdings={holdings}
          dividendHistory={state.dividendHistory}
          currency={currency}
        />
      </div>
      <HoldingsTable holdings={holdings} currency={currency} yieldMetrics={yieldMetrics} />
      <DividendsTable
        holdings={holdings}
        currency={currency}
        onRefresh={handleRefreshDividends}
        refreshing={refreshingDividends}
        error={dividendError}
        updatedAt={dividendsUpdatedAt}
      />
    </div>
  );
}
