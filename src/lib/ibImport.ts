import { Transaction } from "./types";

/** Interactive Brokers "Transaction History" Flex query export (CSV or
 * Excel) is a multi-section table: several `<Section>,Header,...` /
 * `<Section>,Data,...` blocks concatenated one after another - in a CSV
 * that's one block of lines, in an Excel file the same rows laid out
 * across one or more sheets. This only reads the "Transaction History"
 * section, using its own header row to map columns by name so it isn't
 * brittle to IB reordering or adding columns. */
const SECTION = "Transaction History";

const NO_SECTION_MESSAGE = `Couldn't find a "${SECTION}" section in that file. Export a Transaction History Flex query as CSV or Excel from IBKR.`;

/** A spreadsheet cell as returned by either source: plain strings from CSV,
 * or typed values from a parsed Excel sheet. */
type Cell = string | number | boolean | Date | null | undefined;

/** Row types that represent cash received against a specific holding
 * (ordinary dividends, and MSTY-style "payment in lieu of dividend" from
 * securities lending) - grouped by date+symbol and netted against any
 * matching withholding tax row to get one DIVIDEND transaction. */
const DIVIDEND_TYPES = new Set(["Dividend", "Payment in Lieu", "Foreign Tax Withholding"]);

export interface ImportSummary {
  transactions: Array<Omit<Transaction, "id" | "portfolioId">>;
  buyCount: number;
  sellCount: number;
  dividendCount: number;
  dividendTotal: number;
  skippedCount: number;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function cellToString(v: Cell): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function toNumber(v: Cell): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean" || v instanceof Date) return null;
  const t = v.trim();
  if (t === "" || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s/-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

interface Row {
  date: string;
  type: string;
  symbol: string;
  description: string;
  quantity: number | null;
  price: number | null;
  commission: number | null;
  netAmount: number | null;
}

/** Extracts "Transaction History" rows from a grid of cells - a CSV split
 * into lines and fields, or the concatenated rows of every sheet in a
 * parsed Excel file. Both lay the same `<Section>,Header|Data,...` shape
 * out as rows of cells, so one pass handles either source. */
function rowsFromGrid(grid: Cell[][]): Row[] {
  let headerCols: string[] | null = null;
  const rows: Row[] = [];

  for (const fields of grid) {
    if (cellToString(fields[0]) !== SECTION) continue;

    const marker = cellToString(fields[1]);
    if (marker === "Header") {
      headerCols = fields.slice(2).map((h) => cellToString(h));
      continue;
    }
    if (marker !== "Data" || !headerCols) continue;

    const values = fields.slice(2);
    const byName: Record<string, Cell> = {};
    headerCols.forEach((h, i) => {
      byName[h] = values[i];
    });

    rows.push({
      date: cellToString(byName["Date"]),
      type: cellToString(byName["Transaction Type"]),
      symbol: cellToString(byName["Symbol"]),
      description: cellToString(byName["Description"]),
      quantity: toNumber(byName["Quantity"]),
      price: toNumber(byName["Price"]),
      commission: toNumber(byName["Commission"]),
      netAmount: toNumber(byName["Net Amount"]),
    });
  }

  return rows;
}

function gridFromCSV(csvText: string): string[][] {
  return csvText
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map(parseCSVLine);
}

/** Parses Interactive Brokers "Transaction History" rows (already extracted
 * from either a CSV or an Excel file) into this app's Transaction shape.
 * Buy/Sell rows map directly; dividend income is netted from the separate
 * "Dividend"/"Payment in Lieu" and "Foreign Tax Withholding" rows IB
 * reports per date+symbol into a single DIVIDEND transaction. Everything
 * else (interest, forex, account fees, FX P&L adjustments) isn't tied to a
 * holding and can't be represented by this app's transaction model, so
 * it's counted as skipped rather than dropped silently. */
function summarize(rows: Row[]): ImportSummary {
  const tradeRows = rows.filter((r) => r.type === "Buy" || r.type === "Sell");

  const nameBySymbol = new Map<string, string>();
  for (const r of tradeRows) {
    if (r.symbol && r.description && !nameBySymbol.has(r.symbol)) {
      nameBySymbol.set(r.symbol, toTitleCase(r.description));
    }
  }

  // Running quantity-at-date timeline per symbol, built from trades only,
  // so dividend rows (which don't carry a quantity) can be given a sensible
  // "shares held" value for display.
  const timelines = new Map<string, { date: string; qty: number }[]>();
  const sortedTrades = [...tradeRows].sort((a, b) => a.date.localeCompare(b.date));
  const running = new Map<string, number>();
  for (const r of sortedTrades) {
    if (r.quantity == null) continue;
    const prev = running.get(r.symbol) ?? 0;
    const next = r.type === "Buy" ? prev + Math.abs(r.quantity) : prev - Math.abs(r.quantity);
    running.set(r.symbol, next);
    const list = timelines.get(r.symbol) ?? [];
    list.push({ date: r.date, qty: next });
    timelines.set(r.symbol, list);
  }

  function quantityAt(symbol: string, date: string): number {
    const points = timelines.get(symbol);
    if (!points) return 0;
    let qty = 0;
    for (const p of points) {
      if (p.date > date) break;
      qty = p.qty;
    }
    return qty;
  }

  const transactions: Array<Omit<Transaction, "id" | "portfolioId">> = [];

  for (const r of tradeRows) {
    if (r.quantity == null || r.price == null || !r.symbol) continue;
    transactions.push({
      symbol: r.symbol,
      name: nameBySymbol.get(r.symbol),
      type: r.type === "Buy" ? "BUY" : "SELL",
      date: r.date,
      quantity: Math.abs(r.quantity),
      price: r.price,
      fees: r.commission != null ? Math.abs(r.commission) : undefined,
    });
  }

  const dividendGroups = new Map<string, { date: string; symbol: string; amount: number }>();
  let dividendRowCount = 0;
  for (const r of rows) {
    if (!DIVIDEND_TYPES.has(r.type) || !r.symbol || r.netAmount == null) continue;
    dividendRowCount++;
    const key = `${r.date}|${r.symbol}`;
    const group = dividendGroups.get(key) ?? { date: r.date, symbol: r.symbol, amount: 0 };
    group.amount += r.netAmount;
    dividendGroups.set(key, group);
  }

  let dividendTotal = 0;
  for (const group of dividendGroups.values()) {
    if (group.amount === 0) continue;
    const amount = Math.round(group.amount * 100) / 100;
    dividendTotal += amount;
    transactions.push({
      symbol: group.symbol,
      name: nameBySymbol.get(group.symbol),
      type: "DIVIDEND",
      date: group.date,
      quantity: quantityAt(group.symbol, group.date),
      price: amount,
    });
  }

  transactions.sort((a, b) => a.date.localeCompare(b.date));

  return {
    transactions,
    buyCount: tradeRows.filter((r) => r.type === "Buy").length,
    sellCount: tradeRows.filter((r) => r.type === "Sell").length,
    dividendCount: dividendGroups.size,
    dividendTotal,
    skippedCount: rows.length - tradeRows.length - dividendRowCount,
  };
}

/** Parses an Interactive Brokers "Transaction History" activity export
 * saved as CSV. */
export function parseIBTransactionsFromCSV(csvText: string): ImportSummary {
  const rows = rowsFromGrid(gridFromCSV(csvText));
  if (rows.length === 0) throw new Error(NO_SECTION_MESSAGE);
  return summarize(rows);
}

/** Parses an Interactive Brokers "Transaction History" activity export
 * saved as Excel (.xlsx/.xls). IB can lay the report's sections out across
 * more than one sheet, so every sheet is scanned and concatenated before
 * looking for the "Transaction History" rows. */
export async function parseIBTransactionsFromExcel(file: Blob): Promise<ImportSummary> {
  const readExcelFile = (await import("read-excel-file/universal")).default;
  const sheets = await readExcelFile(file);
  const grid = sheets.flatMap((s) => s.data) as Cell[][];
  const rows = rowsFromGrid(grid);
  if (rows.length === 0) throw new Error(NO_SECTION_MESSAGE);
  return summarize(rows);
}
