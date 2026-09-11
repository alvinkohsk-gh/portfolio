import { Holding } from "@/lib/types";
import { groupHoldingsBySector, UNKNOWN_SECTOR } from "@/lib/portfolio";
import { formatPercent } from "@/lib/format";
import { Card, CardTitle } from "./Card";

/** Above this weight in a single sector, the portfolio is flagged as
 * concentrated rather than just diversified-with-a-tilt. */
const CONCENTRATION_THRESHOLD = 40;

export function SectorConcentration({
  holdings,
  sectors,
}: {
  holdings: Holding[];
  sectors: Record<string, string>;
}) {
  const groups = groupHoldingsBySector(holdings, sectors);
  if (groups.length === 0) return null;

  const top = groups[0];
  const concentrated = top.name !== UNKNOWN_SECTOR && top.weight >= CONCENTRATION_THRESHOLD;
  const topThree = groups.slice(0, 3);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <CardTitle>Sector Concentration</CardTitle>
        {concentrated && (
          <span className="text-xs font-medium text-amber-400">Concentrated</span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-xl font-semibold ${concentrated ? "text-amber-400" : "text-white"}`}>
          {formatPercent(top.weight, 1).replace("+", "")}
        </span>
        <span className="text-sm text-neutral-400 truncate">in {top.name}</span>
      </div>
      {concentrated && (
        <p className="mt-1 text-xs text-amber-400/80">
          Over {CONCENTRATION_THRESHOLD}% of open positions sit in a single sector.
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-1.5">
        {topThree.map((g) => (
          <li key={g.name} className="flex items-center gap-2 text-xs">
            <span className="text-neutral-300 truncate flex-1">{g.name}</span>
            <div className="w-24 h-1.5 rounded-full bg-neutral-800 overflow-hidden shrink-0">
              <div
                className={`h-full rounded-full ${
                  g.name === top.name && concentrated ? "bg-amber-400" : "bg-neutral-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, g.weight))}%` }}
              />
            </div>
            <span className="text-neutral-500 tabular-nums w-12 text-right">
              {formatPercent(g.weight, 1).replace("+", "")}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
