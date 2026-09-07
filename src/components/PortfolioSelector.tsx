"use client";

import { usePortfolio } from "@/lib/PortfolioProvider";
import { ALL_PORTFOLIOS } from "@/lib/types";

const NEW_PORTFOLIO = "__new__";

export function PortfolioSelector() {
  const { state, setActivePortfolio, addPortfolio } = usePortfolio();

  return (
    <select
      value={state.activePortfolioId}
      onChange={(e) => {
        if (e.target.value === NEW_PORTFOLIO) {
          const name = prompt("New portfolio name")?.trim();
          if (name) setActivePortfolio(addPortfolio(name));
          return;
        }
        setActivePortfolio(e.target.value);
      }}
      className="rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-sm text-white"
      aria-label="Active portfolio"
    >
      <option value={ALL_PORTFOLIOS}>All Portfolios</option>
      {state.portfolios.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
      <option value={NEW_PORTFOLIO}>+ New portfolio…</option>
    </select>
  );
}
