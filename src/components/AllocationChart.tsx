"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Holding } from "@/lib/types";
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
}: {
  holdings: Holding[];
  currency: string;
}) {
  const open = holdings.filter((h) => h.quantity > 0);
  const data = open.map((h) => ({
    name: h.symbol,
    value: h.marketValue,
    weight: h.weight,
  }));

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
      <CardTitle>Allocation</CardTitle>
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
