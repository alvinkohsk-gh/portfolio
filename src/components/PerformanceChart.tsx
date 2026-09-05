"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PerformancePoint } from "@/lib/portfolio";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardTitle } from "./Card";

export function PerformanceChart({
  data,
  currency,
}: {
  data: PerformancePoint[];
  currency: string;
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardTitle>Invested vs. Current Value</CardTitle>
        <div className="h-64 flex items-center justify-center text-sm text-neutral-500">
          No transactions yet
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Invested vs. Current Value</CardTitle>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="investedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#262626" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => formatDate(d)}
              stroke="#525252"
              tick={{ fontSize: 11 }}
              minTickGap={40}
            />
            <YAxis
              stroke="#525252"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => formatCurrency(v, currency)}
              width={70}
            />
            <Tooltip
              contentStyle={{
                background: "#171717",
                border: "1px solid #404040",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(d) => formatDate(d as string)}
              formatter={(value, name) => [
                formatCurrency(Number(value), currency),
                name === "marketValueAtCurrentPrices" ? "Value (today's prices)" : "Invested",
              ]}
            />
            <Area
              type="stepAfter"
              dataKey="invested"
              stroke="#60a5fa"
              fill="url(#investedFill)"
              strokeWidth={2}
            />
            <Area
              type="stepAfter"
              dataKey="marketValueAtCurrentPrices"
              stroke="#34d399"
              fill="url(#valueFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-neutral-600">
        Shows cumulative capital invested over time against what that position
        would be worth at today&apos;s prices. Not a mark-to-market history.
      </p>
    </Card>
  );
}
