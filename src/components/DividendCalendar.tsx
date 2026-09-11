import { DividendEvent, Holding } from "@/lib/types";
import { estimateNextDividend } from "@/lib/dividends";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardTitle } from "./Card";

export function DividendCalendar({
  holdings,
  dividendHistory,
  currency,
}: {
  holdings: Holding[];
  dividendHistory: Record<string, DividendEvent[]>;
  currency: string;
}) {
  const open = holdings.filter((h) => h.quantity > 0);

  const upcoming = open
    .map((h) => {
      const events = dividendHistory[h.symbol];
      if (!events || events.length === 0) return null;
      const expected = estimateNextDividend(events);
      if (!expected) return null;
      return {
        symbol: h.symbol,
        name: h.name,
        date: expected.date,
        estimatedAmount: expected.amountPerShare * h.quantity,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 sm:p-5 pb-0 flex flex-wrap items-baseline justify-between gap-2">
        <CardTitle>Dividend Calendar</CardTitle>
        {upcoming.length > 0 && (
          <span className="text-xs text-neutral-500">
            Estimated from historical payment cadence
          </span>
        )}
      </div>
      {upcoming.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-sm text-neutral-500 px-4 text-center">
          No upcoming payments to project yet. Use &quot;Refresh dividends&quot; below to
          fetch payment history for your holdings.
        </div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                <th className="px-4 sm:px-5 py-2.5 font-medium">Stock</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Expected Date</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Est. Amount</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((u) => (
                <tr
                  key={u.symbol}
                  className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40"
                >
                  <td className="px-4 sm:px-5 py-3">
                    <div className="font-medium text-white">{u.symbol}</div>
                    <div className="text-xs text-neutral-500 truncate max-w-[140px]">
                      {u.name ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                    {formatDate(u.date)}
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-white">
                    {formatCurrency(u.estimatedAmount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
