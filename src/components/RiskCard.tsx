import { POSITION_CONCENTRATION_THRESHOLD, RiskMetrics } from "@/lib/portfolio";
import { Card } from "./Card";

/** Shows the 52-week-based drawdown/volatility proxies plus the largest
 * single-position concentration from computeRiskMetrics - see that function
 * for why the first two substitute for a true max-drawdown/volatility
 * figure (no historical portfolio value series exists in this app). */
export function RiskCard({ risk }: { risk: RiskMetrics }) {
  const hasFiftyTwoWeekMetrics = risk.distanceFromHighPct != null && risk.rangeWidthPct != null;
  if (!hasFiftyTwoWeekMetrics && risk.largestPosition == null) {
    return null;
  }

  const concentrated =
    risk.largestPosition != null && risk.largestPosition.weightPct >= POSITION_CONCENTRATION_THRESHOLD;

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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {hasFiftyTwoWeekMetrics && (
          <>
            <div>
              <div className="text-xs text-neutral-500">Below 52W high</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-rose-400">
                {risk.distanceFromHighPct!.toFixed(1)}%
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">Weighted average across holdings</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">52W range (volatility proxy)</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-white">
                {risk.rangeWidthPct!.toFixed(1)}%
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">Wider range, more volatile</div>
            </div>
          </>
        )}
        {risk.largestPosition && (
          <div>
            <div className="text-xs text-neutral-500">Largest position</div>
            <div
              className={`mt-1 text-xl font-semibold tabular-nums ${
                concentrated ? "text-amber-400" : "text-white"
              }`}
            >
              {risk.largestPosition.weightPct.toFixed(1)}%
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">
              {risk.largestPosition.symbol}
              {concentrated ? ` - over ${POSITION_CONCENTRATION_THRESHOLD}% of portfolio` : ""}
            </div>
          </div>
        )}
      </div>
      {hasFiftyTwoWeekMetrics && (
        <p className="mt-3 text-[11px] text-neutral-600">
          52W metrics are based on each holding&apos;s 52-week high/low from its last price
          refresh, weighted by portfolio weight - not a true historical max drawdown, since this
          app doesn&apos;t track daily portfolio value over time.
        </p>
      )}
    </Card>
  );
}
