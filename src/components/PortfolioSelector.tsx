"use client";

import { usePortfolio } from "@/lib/PortfolioProvider";
import { ALL_PORTFOLIOS } from "@/lib/types";

export function PortfolioSelector() {
  const { state, setActivePortfolio } = usePortfolio();

  return (
    <select
      value={state.activePortfolioId}
      onChange={(e) => setActivePortfolio(e.target.value)}
      className="rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-sm text-white"
      aria-label="Active portfolio"
    >
      <option value={ALL_PORTFOLIOS}>All Portfolios</option>
      {state.portfolios.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
