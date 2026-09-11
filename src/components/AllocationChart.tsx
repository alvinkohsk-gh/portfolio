"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Holding } from "@/lib/types";
import { groupHoldingsBySector } from "@/lib/portfolio";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card, CardTitle } from "./Card";

const COLORS = [
  "#34d399",
  "#60a5fa",
  "#fbbf24",
  "#f472b6",
  "#a78bfa",
  "#fb923c",
  "#22d3ee",
  "#f87171",
  "#4ade80",
  "#c084fc",
];

export function AllocationChart({
  holdings,
  currency,
  sectors = {},
}: {
  holdings: Holding[];
  currency: string;
  /** Sector per symbol (e.g. "Technology"), fetched from an external
   * provider. Symbols missing here group under "Other" in sector view. */
  sectors?: Record<string, string>;
}) {
  const [groupBy, setGroupBy] = useState<"symbol" | "sector">("symbol");
  const open = holdings.filter((h) => h.quantity > 0);

  const data =
    groupBy === "symbol"
      ? open.map((h) => ({
          name: h.symbol,
          value: h.marketValue,
          weight: h.weight,
        }))
      : groupHoldingsBySector(holdings, sectors);

  if (data.length === 0) {
    return (
      <Card>
        <CardTitle>Allocation</CardTitle>
        <div className="h-64 flex items-center justify-center text-sm text-neutral-500">
          No holdings yet
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Allocation</CardTitle>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setGroupBy("symbol")}
            className={`px-2 py-1 rounded-md text-xs font-medium ${
              groupBy === "symbol"
                ? "bg-neutral-800 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            By Symbol
          </button>
          <button
            onClick={() => setGroupBy("sector")}
            className={`px-2 py-1 rounded-md text-xs font-medium ${
              groupBy === "sector"
                ? "bg-neutral-800 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            By Sector
          </button>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#171717",
                border: "1px solid #404040",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => [
                formatCurrency(Number(value), currency),
                String(name),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-32 overflow-y-auto pr-1">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-neutral-300 truncate">{d.name}</span>
            <span className="text-neutral-500 ml-auto tabular-nums">
              {formatPercent(d.weight, 1).replace("+", "")}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
