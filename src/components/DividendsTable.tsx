import { Holding } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { Card, CardTitle } from "./Card";

/** Every stock that has ever paid a dividend, including positions fully
 * sold since - HoldingsTable only shows currently open positions, so
 * lifetime dividends on a closed position would otherwise be invisible
 * outside the portfolio-wide total on SummaryCards. Dividends are the sum
 * of manually logged DIVIDEND transactions plus, once "Refresh dividends"
 * has been used, amounts estimated from a fetched dividend-history feed for
 * periods without a manual entry. */
export function DividendsTable({
  holdings,
  currency,
  onRefresh,
  refreshing,
  error,
  updatedAt,
}: {
  holdings: Holding[];
  currency: string;
  onRefresh: () => void;
  refreshing: boolean;
  error: string | null;
  updatedAt: string | null;
}) {
  if (holdings.length === 0) return null;

  const paid = holdings
    .filter((h) => h.dividends > 0)
    .sort((a, b) => b.dividends - a.dividends);

  const total = paid.reduce((sum, h) => sum + h.dividends, 0);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 sm:p-5 pb-0 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <CardTitle>Lifetime Dividends</CardTitle>
          <span className="text-sm font-medium text-white">
            {formatCurrency(total, currency)}
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white"
        >
          {refreshing ? "Refreshing…" : "Refresh dividends"}
        </button>
      </div>
      {error && <p className="px-4 sm:px-5 pt-2 text-xs text-amber-400">{error}</p>}
      {paid.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-sm text-neutral-500">
          No dividends recorded yet. Log a DIVIDEND transaction, or refresh to
          estimate them from dividend history.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                <th className="px-4 sm:px-5 py-2.5 font-medium">Stock</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium">Status</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium text-right">
                  Dividends
                </th>
                <th className="px-4 sm:px-5 py-2.5 font-medium text-right">
                  Since
                </th>
              </tr>
            </thead>
            <tbody>
              {paid.map((h) => (
                <tr
                  key={h.symbol}
                  className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40"
                >
                  <td className="px-4 sm:px-5 py-3">
                    <div className="font-medium text-white">{h.symbol}</div>
                    <div className="text-xs text-neutral-500 truncate max-w-[140px]">
                      {h.name ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-xs text-neutral-500">
                    {h.quantity > 0 ? "Open" : "Closed"}
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-white">
                    <div>{formatCurrency(h.dividends, currency)}</div>
                    {h.estimatedDividends > 0 && (
                      <div className="text-xs text-neutral-500">
                        incl. {formatCurrency(h.estimatedDividends, currency)} est.
                      </div>
                    )}
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-xs text-neutral-500">
                    {h.firstBuyDate ? formatDate(h.firstBuyDate) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {updatedAt && (
        <div className="px-4 sm:px-5 py-2.5 border-t border-neutral-900 text-[11px] text-neutral-600">
          Dividend history last fetched {formatDateTime(updatedAt)}
        </div>
      )}
    </Card>
  );
}
