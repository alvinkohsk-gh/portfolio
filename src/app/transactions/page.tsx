"use client";

import { useMemo, useState } from "react";
import { usePortfolio } from "@/lib/PortfolioProvider";
import { allSymbols } from "@/lib/portfolio";
import { Transaction } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card } from "@/components/Card";
import { TransactionModal } from "@/components/TransactionModal";
import clsx from "clsx";

const typeStyles: Record<Transaction["type"], string> = {
  BUY: "bg-emerald-500/15 text-emerald-400",
  SELL: "bg-rose-500/15 text-rose-400",
  DIVIDEND: "bg-blue-500/15 text-blue-400",
};

export default function TransactionsPage() {
  const { state, addTransaction, updateTransaction, deleteTransaction } = usePortfolio();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [filterSymbol, setFilterSymbol] = useState<string>("ALL");

  const symbols = useMemo(() => allSymbols(state), [state]);

  const rows = useMemo(() => {
    return [...state.transactions]
      .filter((t) => filterSymbol === "ALL" || t.symbol === filterSymbol)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.transactions, filterSymbol]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(tx: Transaction) {
    setEditing(tx);
    setModalOpen(true);
  }

  function handleSubmit(tx: Omit<Transaction, "id">) {
    if (editing) {
      updateTransaction(editing.id, tx);
    } else {
      addTransaction(tx);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">Transactions</h1>
        <div className="flex items-center gap-2">
          <select
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-white"
          >
            <option value="ALL">All symbols</option>
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={openAdd}
            className="px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            + Add transaction
          </button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {rows.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-neutral-500">
            No transactions yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Date</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Type</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Quantity</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Price</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Total</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const total =
                    t.type === "DIVIDEND"
                      ? t.price
                      : t.quantity * t.price + (t.fees ?? 0) * (t.type === "BUY" ? 1 : -1);
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40"
                    >
                      <td className="px-4 sm:px-5 py-3 text-neutral-300 whitespace-nowrap">
                        {formatDate(t.date)}
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            typeStyles[t.type]
                          )}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <div className="font-medium text-white">{t.symbol}</div>
                        {t.name && <div className="text-xs text-neutral-500">{t.name}</div>}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {t.quantity}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-neutral-300">
                        {formatCurrency(t.price, state.currency)}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right tabular-nums text-white">
                        {formatCurrency(total, state.currency)}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEdit(t)}
                          className="text-xs text-neutral-400 hover:text-white mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete this ${t.type.toLowerCase()} transaction?`)) {
                              deleteTransaction(t.id);
                            }
                          }}
                          className="text-xs text-rose-500 hover:text-rose-400"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        initial={editing}
        knownSymbols={symbols}
      />
    </div>
  );
}
