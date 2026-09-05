"use client";

import { useRef, useState } from "react";
import { usePortfolio } from "@/lib/PortfolioProvider";
import { allSymbols, computeHoldings } from "@/lib/portfolio";
import { formatCurrency } from "@/lib/format";
import { Card, CardTitle } from "@/components/Card";
import { Portfolio, PortfolioState, Transaction } from "@/lib/types";
import { migrate } from "@/lib/store";
import {
  ImportedTransaction,
  parseIbkrTransactionsCsv,
  partitionNewTransactions,
} from "@/lib/ibkrImport";

const CURRENCIES = ["USD", "SGD", "EUR", "GBP", "HKD", "JPY", "AUD", "CAD"];

export default function SettingsPage() {
  const {
    state,
    setCurrency,
    setPrice,
    replaceState,
    resetToSample,
    clearAll,
    addPortfolio,
    renamePortfolio,
    deletePortfolio,
  } = usePortfolio();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [newPortfolioName, setNewPortfolioName] = useState("");

  const symbols = allSymbols(state);
  const holdings = computeHoldings(state);

  function handleExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    setImportError(null);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as PortfolioState;
        if (!Array.isArray(parsed.transactions) || typeof parsed.prices !== "object") {
          throw new Error("Invalid file shape");
        }
        replaceState(migrate(parsed));
        setImportError(null);
      } catch {
        setImportError("Couldn't read that file. Make sure it's a JSON export from this app.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-xl font-semibold text-white">Settings</h1>

      <Card>
        <CardTitle>Display currency</CardTitle>
        <select
          value={state.currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-neutral-500">
          This relabels amounts; it does not convert values between currencies.
        </p>
      </Card>

      <Card>
        <CardTitle>Portfolios</CardTitle>
        <div className="flex flex-col gap-2">
          {state.portfolios.map((p) => {
            const count = state.transactions.filter((t) => t.portfolioId === p.id).length;
            return (
              <PortfolioRow
                key={p.id}
                name={p.name}
                transactionCount={count}
                canDelete={state.portfolios.length > 1}
                onRename={(name) => renamePortfolio(p.id, name)}
                onDelete={() => {
                  if (
                    confirm(
                      count > 0
                        ? `Delete "${p.name}" and its ${count} transaction${
                            count === 1 ? "" : "s"
                          }? This can't be undone.`
                        : `Delete "${p.name}"?`
                    )
                  ) {
                    deletePortfolio(p.id);
                  }
                }}
              />
            );
          })}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = newPortfolioName.trim();
            if (!name) return;
            addPortfolio(name);
            setNewPortfolioName("");
          }}
          className="mt-3 flex items-center gap-2"
        >
          <input
            value={newPortfolioName}
            onChange={(e) => setNewPortfolioName(e.target.value)}
            placeholder="New portfolio name"
            className="w-48 rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-sm text-white"
          />
          <button
            type="submit"
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
          >
            Add portfolio
          </button>
        </form>
      </Card>

      <Card>
        <CardTitle>Manual prices</CardTitle>
        {symbols.length === 0 ? (
          <p className="text-sm text-neutral-500">No symbols yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {symbols.map((symbol) => {
              const holding = holdings.find((h) => h.symbol === symbol);
              return (
                <ManualPriceRow
                  key={symbol}
                  symbol={symbol}
                  currentPrice={holding?.currentPrice}
                  currency={state.currency}
                  onSave={(price) => setPrice(symbol, price)}
                />
              );
            })}
          </div>
        )}
      </Card>

      <BrokerImportCard
        portfolios={state.portfolios}
        existingTransactions={state.transactions}
      />

      <Card>
        <CardTitle>Backup &amp; restore</CardTitle>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-2 rounded-md text-sm font-medium bg-neutral-800 hover:bg-neutral-700 text-white"
          >
            Export data (JSON)
          </button>
          <button
            onClick={handleImportClick}
            className="px-3 py-2 rounded-md text-sm font-medium bg-neutral-800 hover:bg-neutral-700 text-white"
          >
            Import data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        {importError && <p className="mt-2 text-xs text-rose-400">{importError}</p>}
        <p className="mt-2 text-xs text-neutral-500">
          Everything is stored only in this browser. Export regularly if you want a backup,
          or to move to another device.
        </p>
      </Card>

      <Card>
        <CardTitle>Danger zone</CardTitle>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (confirm("Replace current data with the sample portfolio?")) resetToSample();
            }}
            className="px-3 py-2 rounded-md text-sm font-medium bg-neutral-800 hover:bg-neutral-700 text-white"
          >
            Load sample data
          </button>
          <button
            onClick={() => {
              if (confirm("This will permanently delete all transactions, prices, watchlist items, and portfolios. Continue?")) {
                clearAll();
              }
            }}
            className="px-3 py-2 rounded-md text-sm font-medium bg-rose-600/90 hover:bg-rose-500 text-white"
          >
            Clear all data
          </button>
        </div>
      </Card>
    </div>
  );
}

function PortfolioRow({
  name,
  transactionCount,
  canDelete,
  onRename,
  onDelete,
}: {
  name: string;
  transactionCount: number;
  canDelete: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(name);
  const dirty = value.trim() !== name && value.trim().length > 0;

  return (
    <div className="flex items-center gap-3">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-48 rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-sm text-white"
      />
      <span className="text-xs text-neutral-500 w-20">
        {transactionCount} tx{transactionCount === 1 ? "" : "s"}
      </span>
      {dirty && (
        <button
          onClick={() => onRename(value.trim())}
          className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
        >
          Save
        </button>
      )}
      <button
        onClick={onDelete}
        disabled={!canDelete}
        title={canDelete ? undefined : "At least one portfolio is required"}
        className="ml-auto text-xs font-medium text-rose-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Delete
      </button>
    </div>
  );
}

function ManualPriceRow({
  symbol,
  currentPrice,
  currency,
  onSave,
}: {
  symbol: string;
  currentPrice?: number;
  currency: string;
  onSave: (price: number) => void;
}) {
  const [value, setValue] = useState(currentPrice != null ? String(currentPrice) : "");

  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-sm font-medium text-white">{symbol}</span>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={currentPrice != null ? formatCurrency(currentPrice, currency) : "0.00"}
        className="w-32 rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-sm text-white"
      />
      <button
        onClick={() => value && onSave(Number(value))}
        className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
      >
        Save
      </button>
    </div>
  );
}

const SKIPPED_TYPE_LABELS: Record<string, string> = {
  "Debit Interest": "interest/borrow fees",
  "Credit Interest": "interest credits",
  "Other Fee": "other fees",
  "Sales Tax": "sales tax",
  Adjustment: "FX translation adjustments",
  "Forex Trade Component": "currency conversions",
};

interface ImportPreview {
  toAdd: ImportedTransaction[];
  duplicateCount: number;
  skippedByType: Record<string, number>;
}

/** Imports an Interactive Brokers "Transaction History" CSV (Account
 * Management > Reports > Statements > Activity) as BUY/SELL/DIVIDEND
 * transactions on a chosen portfolio. Parsing happens entirely client-side,
 * consistent with this app never sending portfolio data to a server. */
function BrokerImportCard({
  portfolios,
  existingTransactions,
}: {
  portfolios: Portfolio[];
  existingTransactions: Transaction[];
}) {
  const { importTransactions } = usePortfolio();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.id ?? "");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImported(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { transactions, skippedByType } = parseIbkrTransactionsCsv(
          String(reader.result)
        );
        if (transactions.length === 0) {
          setPreview(null);
          setError("No Buy/Sell/Dividend rows found in that file.");
          return;
        }
        const { toAdd, duplicateCount } = partitionNewTransactions(
          transactions,
          existingTransactions
        );
        setPreview({ toAdd, duplicateCount, skippedByType });
      } catch {
        setPreview(null);
        setError("Couldn't read that file. Make sure it's an IBKR Transaction History CSV export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleImport() {
    if (!preview || preview.toAdd.length === 0 || !portfolioId) return;
    importTransactions(preview.toAdd.map((t) => ({ ...t, portfolioId })));
    setImported(preview.toAdd.length);
    setPreview(null);
    setFileName(null);
  }

  const skippedEntries = preview
    ? Object.entries(preview.skippedByType).filter(([, count]) => count > 0)
    : [];
  const skippedTotal = skippedEntries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <Card>
      <CardTitle>Import from broker</CardTitle>
      <p className="text-xs text-neutral-500 mb-3">
        Import Buy/Sell trades and dividends from an Interactive Brokers
        &quot;Transaction History&quot; CSV export (Account Management &gt;
        Reports &gt; Statements &gt; Activity). Re-importing an overlapping
        date range skips anything already added.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={portfolioId}
          onChange={(e) => setPortfolioId(e.target.value)}
          className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
        >
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-2 rounded-md text-sm font-medium bg-neutral-800 hover:bg-neutral-700 text-white"
        >
          Choose IBKR CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
        {fileName && <span className="text-xs text-neutral-500">{fileName}</span>}
      </div>

      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}

      {imported != null && (
        <p className="mt-2 text-xs text-emerald-400">
          Imported {imported} transaction{imported === 1 ? "" : "s"}.
        </p>
      )}

      {preview && (
        <div className="mt-3 rounded-md border border-neutral-800 p-3 text-sm">
          <p className="text-neutral-300">
            Found <span className="text-white font-medium">{preview.toAdd.length}</span>{" "}
            new transaction{preview.toAdd.length === 1 ? "" : "s"} to import
            {preview.duplicateCount > 0 && (
              <> ({preview.duplicateCount} already imported, skipped)</>
            )}
            .
          </p>
          {skippedTotal > 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              Not imported ({skippedTotal} row{skippedTotal === 1 ? "" : "s"} - not tied to a
              holding):{" "}
              {skippedEntries
                .map(([type, count]) => `${count} ${SKIPPED_TYPE_LABELS[type] ?? type}`)
                .join(", ")}
            </p>
          )}
          <button
            onClick={handleImport}
            disabled={preview.toAdd.length === 0 || !portfolioId}
            className="mt-3 px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white"
          >
            Import {preview.toAdd.length} transaction{preview.toAdd.length === 1 ? "" : "s"}
          </button>
        </div>
      )}
    </Card>
  );
}
