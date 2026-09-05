import { Transaction, TransactionType } from "./types";

export type ImportedTransaction = Omit<Transaction, "id" | "portfolioId">;

export interface ImportResult {
  transactions: ImportedTransaction[];
  /** Rows recognized but not tied to a symbol this app tracks (interest,
   * fees, FX conversions, ...), grouped by their IBKR "Transaction Type". */
  skippedByType: Record<string, number>;
}

const TRADE_TYPES: Record<string, TransactionType> = { Buy: "BUY", Sell: "SELL" };
const DIVIDEND_TYPES = new Set(["Dividend", "Payment in Lieu", "Foreign Tax Withholding"]);

/** Minimal CSV row splitter that understands double-quoted fields (with ""
 * escaping) - IBKR quotes text containing commas, e.g. "Sep 4, 2025 - Sep
 * 4, 2026" or "Net Amount in Base from Forex Trade: 6,132.81 USD.SGD". */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

function toNumber(raw: string | undefined): number | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed === "-") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Parses an Interactive Brokers "Transaction History" CSV export (Account
 * Management > Reports > Statements > Activity, or an equivalent Flex
 * Query) into this app's Transaction shape.
 *
 * Only rows tied to a specific holding turn into transactions: Buy/Sell
 * trades, and dividend-related cash flows (Dividend, Payment in Lieu of
 * Dividend, and their Foreign Tax Withholding). Each of those is imported
 * as its own DIVIDEND entry rather than trying to net a dividend against
 * its withholding row - they land on the same symbol and sum correctly
 * either way, and IBKR doesn't always keep the pair adjacent or even under
 * the same symbol (a ticker change can leave the withholding row tagged
 * with the old symbol). Interest, fees, sales tax and FX conversions aren't
 * tied to a symbol this app tracks, so they're counted but not imported. */
export function parseIbkrTransactionsCsv(text: string): ImportResult {
  const transactions: ImportedTransaction[] = [];
  const skippedByType: Record<string, number> = {};
  let columns: string[] | null = null;

  for (const line of text.split(/\r?\n/)) {
    if (line.length === 0) continue;
    const fields = splitCsvLine(line);
    if (fields[0] !== "Transaction History") continue;

    if (fields[1] === "Header") {
      columns = fields.slice(2).map((c) => c.trim());
      continue;
    }
    if (fields[1] !== "Data" || !columns) continue;

    const row: Record<string, string> = {};
    columns.forEach((col, i) => (row[col] = fields[2 + i] ?? ""));

    const type = row["Transaction Type"];
    const symbol = row["Symbol"]?.trim();
    const date = row["Date"]?.trim();

    if (!date || !symbol || symbol === "-") {
      skippedByType[type] = (skippedByType[type] ?? 0) + 1;
      continue;
    }

    const tradeType = TRADE_TYPES[type];
    if (tradeType) {
      const quantity = toNumber(row["Quantity"]);
      const price = toNumber(row["Price"]);
      if (quantity == null || price == null) {
        skippedByType[type] = (skippedByType[type] ?? 0) + 1;
        continue;
      }
      const fees = toNumber(row["Commission"]);
      transactions.push({
        symbol,
        name: row["Description"]?.trim() || undefined,
        type: tradeType,
        date,
        quantity: Math.abs(quantity),
        price: Math.abs(price),
        fees: fees != null ? Math.abs(fees) : undefined,
      });
      continue;
    }

    if (DIVIDEND_TYPES.has(type)) {
      const netAmount = toNumber(row["Net Amount"]);
      if (netAmount == null) {
        skippedByType[type] = (skippedByType[type] ?? 0) + 1;
        continue;
      }
      transactions.push({
        symbol,
        type: "DIVIDEND",
        date,
        quantity: 0,
        price: netAmount,
      });
      continue;
    }

    skippedByType[type] = (skippedByType[type] ?? 0) + 1;
  }

  return { transactions, skippedByType };
}

function transactionKey(t: {
  date: string;
  symbol: string;
  type: TransactionType;
  quantity: number;
  price: number;
}): string {
  return [t.date, t.symbol, t.type, t.quantity, t.price].join("|");
}

/** Splits freshly parsed transactions into ones not already present in
 * `existing` and ones that are - so re-importing an overlapping date range
 * from the same (or a newer) broker export doesn't duplicate entries. */
export function partitionNewTransactions(
  candidates: ImportedTransaction[],
  existing: Transaction[]
): { toAdd: ImportedTransaction[]; duplicateCount: number } {
  const existingKeys = new Set(existing.map(transactionKey));
  const toAdd: ImportedTransaction[] = [];
  let duplicateCount = 0;
  for (const candidate of candidates) {
    if (existingKeys.has(transactionKey(candidate))) {
      duplicateCount++;
    } else {
      toAdd.push(candidate);
    }
  }
  return { toAdd, duplicateCount };
}
