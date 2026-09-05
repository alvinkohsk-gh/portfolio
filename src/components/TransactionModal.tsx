"use client";

import { useState } from "react";
import { Portfolio, Transaction, TransactionType } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (tx: Omit<Transaction, "id">) => void;
  initial?: Transaction | null;
  knownSymbols: string[];
  portfolios: Portfolio[];
  defaultPortfolioId: string;
}

function emptyForm(defaultPortfolioId: string) {
  return {
    portfolioId: defaultPortfolioId,
    symbol: "",
    name: "",
    type: "BUY" as TransactionType,
    date: new Date().toISOString().slice(0, 10),
    quantity: "",
    price: "",
    fees: "",
    notes: "",
  };
}

function formFromTransaction(tx: Transaction) {
  return {
    portfolioId: tx.portfolioId,
    symbol: tx.symbol,
    name: tx.name ?? "",
    type: tx.type,
    date: tx.date,
    quantity: String(tx.quantity),
    price: String(tx.price),
    fees: tx.fees != null ? String(tx.fees) : "",
    notes: tx.notes ?? "",
  };
}

// The parent only renders this component while `open` is true, and fully
// unmounts it on close - so a fresh useState initializer (keyed on
// `initial`'s identity below) is enough to reset/seed the form, no effect
// needed.
export function TransactionModal({
  open,
  onClose,
  onSubmit,
  initial,
  knownSymbols,
  portfolios,
  defaultPortfolioId,
}: Props) {
  if (!open) return null;
  return (
    <TransactionForm
      key={initial?.id ?? "new"}
      onClose={onClose}
      onSubmit={onSubmit}
      initial={initial}
      knownSymbols={knownSymbols}
      portfolios={portfolios}
      defaultPortfolioId={defaultPortfolioId}
    />
  );
}

function TransactionForm({
  onClose,
  onSubmit,
  initial,
  knownSymbols,
  portfolios,
  defaultPortfolioId,
}: Omit<Props, "open">) {
  const [form, setForm] = useState(
    initial ? formFromTransaction(initial) : emptyForm(defaultPortfolioId)
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.symbol.trim() || !form.quantity || !form.price) return;
    onSubmit({
      portfolioId: form.portfolioId,
      symbol: form.symbol.trim().toUpperCase(),
      name: form.name.trim() || undefined,
      type: form.type,
      date: form.date,
      quantity: Number(form.quantity),
      price: Number(form.price),
      fees: form.fees ? Number(form.fees) : undefined,
      notes: form.notes.trim() || undefined,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4">
          {initial ? "Edit transaction" : "Add transaction"}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Portfolio
            <select
              value={form.portfolioId}
              onChange={(e) => setForm((f) => ({ ...f, portfolioId: e.target.value }))}
              className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Type
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TransactionType }))}
                className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
              >
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
                <option value="DIVIDEND">Dividend</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Date
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
                className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Symbol
            <input
              type="text"
              list="known-symbols"
              value={form.symbol}
              onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
              placeholder="AAPL or D05.SI"
              required
              className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white uppercase"
            />
            <datalist id="known-symbols">
              {knownSymbols.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <span className="text-[11px] text-neutral-600 normal-case">
              SGX counters resolve with or without the .SI suffix (e.g. D05 or D05.SI for DBS).
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Company name (optional)
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Apple Inc."
              className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              {form.type === "DIVIDEND" ? "Shares held" : "Quantity"}
              <input
                type="number"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                required
                className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              {form.type === "DIVIDEND" ? "Total amount" : "Price / share"}
              <input
                type="number"
                step="any"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                required
                className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
              />
            </label>
          </div>

          {form.type !== "DIVIDEND" && (
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Fees (optional)
              <input
                type="number"
                step="any"
                value={form.fees}
                onChange={(e) => setForm((f) => ({ ...f, fees: e.target.value }))}
                className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
              />
            </label>
          )}

          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Notes (optional)
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
            />
          </label>

          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-md text-sm font-medium text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {initial ? "Save changes" : "Add transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
