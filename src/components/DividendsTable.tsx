import { Holding } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardTitle } from "./Card";

/** Every stock that has ever paid a dividend, including positions fully
 * sold since - HoldingsTable only shows currently open positions, so
 * lifetime dividends on a closed position would otherwise be invisible
 * outside the portfolio-wide total on SummaryCards. */
export function DividendsTable({
  holdings,
  currency,
}: {
  holdings: Holding[];
  currency: string;
}) {
  const paid = holdings
    .filter((h) => h.dividends > 0)
    .sort((a, b) => b.dividends - a.dividends);

  if (paid.length === 0) return null;

  const total = paid.reduce((sum, h) => sum + h.dividends, 0);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 sm:p-5 pb-0 flex items-baseline justify-between">
        <CardTitle>Lifetime Dividends</CardTitle>
        <span className="text-sm font-medium text-white">
          {formatCurrency(total, currency)}
        </span>
      </div>
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
                  {formatCurrency(h.dividends, currency)}
                </td>
                <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-xs text-neutral-500">
                  {h.firstBuyDate ? formatDate(h.firstBuyDate) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
