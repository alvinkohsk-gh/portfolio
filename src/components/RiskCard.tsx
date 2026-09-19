import { RiskMetrics } from "@/lib/portfolio";
import { Card } from "./Card";

/** Shows the two 52-week-based risk proxies from computeRiskMetrics - see
 * that function for why these substitute for a true max-drawdown/volatility
 * figure (no historical portfolio value series exists in this app). */
export function RiskCard({ risk }: { risk: RiskMetrics }) {
  if (risk.distanceFromHighPct == null || risk.rangeWidthPct == null) {
    return null;
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-neutral-400">Risk</h2>
        {risk.uncoveredCount > 0 && (
          <span className="text-[11px] text-neutral-600">
            {risk.uncoveredCount} holding{risk.uncoveredCount === 1 ? "" : "s"} excluded (no 52W data)
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-neutral-500">Below 52W high</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-rose-400">
            {risk.distanceFromHighPct.toFixed(1)}%
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">Weighted average across holdings</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">52W range (volatility proxy)</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-white">
            {risk.rangeWidthPct.toFixed(1)}%
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">Wider range, more volatile</div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-neutral-600">
        Based on each holding&apos;s 52-week high/low from its last price refresh, weighted by
        portfolio weight - not a true historical max drawdown, since this app doesn&apos;t track
        daily portfolio value over time.
      </p>
    </Card>
  );
}
