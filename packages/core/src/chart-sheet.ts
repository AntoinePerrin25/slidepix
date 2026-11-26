/** Chart grids parsed from pasted text or a CSV, TSV, or XLSX file. */

import { unzipSync } from "fflate";

export type ChartColumnRole = "category" | "series" | "ignore";

export type ChartSheetModel = {
  headers: string[];
  roles: ChartColumnRole[];
  rows: string[][];
  source?: { src: string; storage: "linked" | "embedded" };
};

export type ParsedChartTable = {
  headers: string[];
  roles: ChartColumnRole[];
  rows: string[][];
  truncated: boolean;
};

export const CHART_SHEET_COLUMNS = 12;
export const CHART_SHEET_ROWS = 50;
const CHART_FILE_BYTES = 2_000_000;

export function sheetFromChart(categories: readonly string[], series: readonly { name: string; values: readonly number[] }[]): ChartSheetModel {
  const labels = categories.length ? [...categories] : ["A"];
  const headers = ["Category", ...series.map((item) => item.name || "Series")];
  const roles: ChartColumnRole[] = ["category", ...series.map(() => "series" as const)];
  const rows = labels.map((label, row) => [label, ...series.map((item) => item.values[row] === undefined ? "" : String(item.values[row]))]);
  return clampSheet({ headers, roles, rows });
}

export function seriesColumn(sheet: ChartSheetModel, seriesIndex: number): number {
  let seen = 0;
  for (let index = 0; index < sheet.headers.length; index += 1) {
    if (sheet.roles[index] !== "series") continue;
    if (seen === seriesIndex) return index;
    seen += 1;
  }
  return -1;
}

export function clampSheet(sheet: ChartSheetModel): ChartSheetModel {
  const headers = sheet.headers.slice(0, CHART_SHEET_COLUMNS).map((header) => header.slice(0, 80));
  if (!headers.length) headers.push("Series");
  const roles = headers.map((_, index) => sheet.roles[index] ?? (headers.length > 1 && index === 0 ? "category" : "series"));
  if (!roles.includes("series")) roles[roles.length - 1] = "series";
  let categorySeen = false;
  for (let index = 0; index < roles.length; index += 1) {
    if (roles[index] !== "category") continue;
    if (categorySeen) roles[index] = "ignore";
    categorySeen = true;
  }
  const rows = sheet.rows.slice(0, CHART_SHEET_ROWS).map((row) => headers.map((_, index) => (row[index] ?? "").slice(0, 400)));
  const source = sheet.source?.src ? { src: sheet.source.src, storage: sheet.source.storage } : undefined;
  return { headers, roles, rows, source };
}

export function parseChartTable(text: string): ParsedChartTable {
  const matrix = parseDelimited(text.replace(/^\uFEFF/, ""), detectDelimiter(text));
  while (matrix.length && matrix[matrix.length - 1]!.every((cell) => !cell.trim())) matrix.pop();
  if (!matrix.length || matrix.every((row) => row.every((cell) => !cell.trim()))) throw new Error("The chart file has no values.");
  const width = Math.min(CHART_SHEET_COLUMNS, Math.max(...matrix.map((row) => row.length)));
  const truncated = matrix.length > CHART_SHEET_ROWS + 1 || matrix.some((row) => row.length > CHART_SHEET_COLUMNS);
  const headers = matrix[0]!.slice(0, width).map((cell, index) => cell.trim().slice(0, 80) || (index === 0 && width > 1 ? "Category" : `Series ${index}`));
  const rows = matrix.slice(1, CHART_SHEET_ROWS + 1).map((row) => headers.map((_, index) => (row[index] ?? "").trim().slice(0, 400)));
  return { headers, roles: rolesFor(headers), rows, truncated };
}

export function parseChartFile(name: string, bytes: Uint8Array): ParsedChartTable {
  if (bytes.byteLength > CHART_FILE_BYTES) throw new Error("Chart files are limited to 2 MB.");
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsm") || lower.endsWith(".xls")) throw new Error("Save the spreadsheet as .xlsx or .csv.");
  if (lower.endsWith(".xlsx")) return parseXlsx(bytes);
  return parseChartTable(new TextDecoder().decode(bytes));
}

export function rolesFor(headers: readonly string[]): ChartColumnRole[] {
  if (headers.length <= 1) return ["series"];
  return headers.map((_, index) => index === 0 ? "category" : "series");
}

function detectDelimiter(text: string): "," | "\t" | ";" {
  const line = firstRecord(text);
  const counts = { ",": 0, "\t": 0, ";": 0 };
  let quote = false;
  for (const character of line) {
    if (character === "\"") quote = !quote;
    else if (!quote && character in counts) counts[character as "," | "\t" | ";"] += 1;
  }
  if (counts["\t"] >= counts[","] && counts["\t"] >= counts[";"] && counts["\t"] > 0) return "\t";
  if (counts[";"] > counts[","]) return ";";
  return ",";
}

function firstRecord(text: string): string {
  let quote = false;
  let value = "";
  for (const character of text) {
    if (character === "\"") quote = !quote;
    else if (!quote && (character === "\n" || character === "\r")) break;
    value += character;
  }
  return value;
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quote = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quote) {
      if (character === "\"" && text[index + 1] === "\"") { cell += "\""; index += 1; }
      else if (character === "\"") quote = false;
      else cell += character;
      continue;
    }
    if (character === "\"") quote = true;
    else if (character === delimiter) { row.push(cell); cell = ""; }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function parseXlsx(bytes: Uint8Array): ParsedChartTable {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter: (file) => /^(xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/[^/]+\.xml)$/.test(file.name) });
  } catch {
    throw new Error("The spreadsheet could not be read. Save it again as .xlsx.");
  }
  const uncompressed = Object.values(entries).reduce((sum, file) => sum + file.byteLength, 0);
  if (uncompressed > 8_000_000) throw new Error("The spreadsheet is too large to import.");
  const workbook = entries["xl/workbook.xml"];
  if (!workbook) throw new Error("This spreadsheet has no workbook.");
  const sheetId = /<(?:[\w]+:)?sheet\b[^>]*\br:id="([^"]+)"/.exec(textOf(workbook))?.[1];
  const rels = entries["xl/_rels/workbook.xml.rels"];
  let sheetPath = "xl/worksheets/sheet1.xml";
  if (rels && sheetId) {
    const relsXml = textOf(rels);
    const target = new RegExp(`Id="${escapeRegExp(sheetId)}"[^>]*Target="([^"]+)"`).exec(relsXml)?.[1]
      ?? new RegExp(`Target="([^"]+)"[^>]*Id="${escapeRegExp(sheetId)}"`).exec(relsXml)?.[1];
    if (target) {
      if (target.includes("..")) throw new Error("The spreadsheet could not be read. Save it again as .xlsx.");
      const clean = target.replaceAll("\\", "/");
      sheetPath = clean.startsWith("/") ? clean.slice(1) : `xl/${clean.replace(/^\.\//, "")}`;
    }
  }
  const sheet = entries[sheetPath] ?? entries["xl/worksheets/sheet1.xml"];
  if (!sheet) throw new Error("The first worksheet could not be read.");
  return gridFromWorksheet(textOf(sheet), sharedStrings(entries["xl/sharedStrings.xml"]));
}

function sharedStrings(bytes: Uint8Array | undefined): string[] {
  if (!bytes) return [];
  const values: string[] = [];
  for (const item of textOf(bytes).matchAll(/<(?:[\w]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[\w]+:)?si>/g)) {
    values.push([...(item[1] ?? "").matchAll(/<(?:[\w]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w]+:)?t>/g)].map((part) => decodeXml(part[1] ?? "")).join(""));
  }
  return values;
}

function gridFromWorksheet(xml: string, strings: readonly string[]): ParsedChartTable {
  const grid = new Map<string, string>();
  let maxRow = -1;
  let maxColumn = -1;
  let truncated = false;
  for (const match of xml.matchAll(/<(?:[\w]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w]+:)?c>)/g)) {
    const ref = /\br="([A-Z]+)(\d+)"/.exec(match[1] ?? "");
    if (!ref) continue;
    const column = columnIndex(ref[1]!);
    const row = Number(ref[2]) - 1;
    if (column >= CHART_SHEET_COLUMNS || row > CHART_SHEET_ROWS) { truncated = true; continue; }
    const type = /\bt="([^"]+)"/.exec(match[1] ?? "")?.[1];
    const body = match[2] ?? "";
    let value = "";
    if (type === "inlineStr") value = [...body.matchAll(/<(?:[\w]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w]+:)?t>/g)].map((part) => decodeXml(part[1] ?? "")).join("");
    else {
      const raw = /<(?:[\w]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w]+:)?v>/.exec(body)?.[1] ?? "";
      value = type === "s" ? strings[Number(raw)] ?? "" : decodeXml(raw);
    }
    grid.set(`${row},${column}`, value.slice(0, 400));
    maxRow = Math.max(maxRow, row);
    maxColumn = Math.max(maxColumn, column);
  }
  if (maxRow < 0) throw new Error("The first worksheet has no values.");
  const width = maxColumn + 1;
  const matrix = Array.from({ length: maxRow + 1 }, (_, row) => Array.from({ length: width }, (_, column) => grid.get(`${row},${column}`) ?? ""));
  const headers = (matrix[0] ?? []).map((cell, index) => cell.trim().slice(0, 80) || (index === 0 && width > 1 ? "Category" : `Series ${index}`));
  return { headers, roles: rolesFor(headers), rows: matrix.slice(1), truncated };
}

function columnIndex(letters: string): number {
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return value - 1;
}

function textOf(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
