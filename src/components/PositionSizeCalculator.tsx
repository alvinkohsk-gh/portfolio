"use client";

import { useState } from "react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Prefills the account value field from the current portfolio total,
   * still freely editable (e.g. to size against just the cash earmarked
   * for this trade rather than the whole account). */
  defaultAccountValue: number;
  currency: string;
}

const DEFAULT_RISK_PCT = "1";

/** Position sizing from fixed-fractional risk: how many shares to buy so
 * that if the stop is hit, the loss is no more than riskPct of the account
 * value - rather than picking a share count first and hoping. This is a
 * planning aid only; it doesn't place or validate against any order. */
export function PositionSizeCalculator({ open, onClose, defaultAccountValue, currency }: Props) {
  const [accountValue, setAccountValue] = useState(String(Math.round(defaultAccountValue)));
  const [riskPct, setRiskPct] = useState(DEFAULT_RISK_PCT);
  const [entryPrice, setEntryPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");

  if (!open) return null;

  const account = Number(accountValue);
  const risk = Number(riskPct);
  const entry = Number(entryPrice);
  const stop = Number(stopPrice);

  const perShareRisk = Math.abs(entry - stop);
  const riskAmount = account > 0 && risk > 0 ? account * (risk / 100) : undefined;
  const shares =
    riskAmount != null && perShareRisk > 0 ? Math.floor(riskAmount / perShareRisk) : undefined;
  const positionValue = shares != null && entry > 0 ? shares * entry : undefined;
  const positionPct = positionValue != null && account > 0 ? (positionValue / account) * 100 : undefined;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-1">Position size calculator</h3>
        <p className="text-xs text-neutral-500 mb-4">
          Sizes a trade so a stop-out risks no more than a fixed % of your account - a planning
          aid only, it doesn&apos;t place or validate against any order.
        </p>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Account value ({currency})
              <input
                type="number"
                step="any"
                value={accountValue}
                onChange={(e) => setAccountValue(e.target.value)}
                className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Risk per trade (%)
              <input
                type="number"
                step="any"
                value={riskPct}
                onChange={(e) => setRiskPct(e.target.value)}
                className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Entry price
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Stop price
              <input
                type="number"
                step="any"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="rounded-lg bg-neutral-950 border border-neutral-800 p-3.5 mt-1 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Risk amount</span>
              <span className="text-white tabular-nums">
                {riskAmount != null ? formatCurrency(riskAmount, currency) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Risk per share</span>
              <span className="text-white tabular-nums">
                {perShareRisk > 0 ? formatCurrency(perShareRisk, currency) : "—"}
              </span>
            </div>
            <div className="flex justify-between border-t border-neutral-800 pt-1.5 mt-0.5">
              <span className="text-neutral-400 font-medium">Suggested shares</span>
              <span className="text-emerald-400 font-semibold tabular-nums">
                {shares != null ? formatNumber(shares, 0) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Position value</span>
              <span className="text-white tabular-nums">
                {positionValue != null ? formatCurrency(positionValue, currency) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Position % of account</span>
              <span className="text-white tabular-nums">
                {positionPct != null ? formatPercent(positionPct).replace("+", "") : "—"}
              </span>
            </div>
          </div>

          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-md text-sm font-medium text-neutral-300 hover:bg-neutral-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
